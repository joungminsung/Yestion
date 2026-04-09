import OpenAI from "openai";

export type MeetingEvidenceItem = {
  title: string | null;
  text: string;
  detail: string | null;
  evidenceUtteranceIds: string[];
};

export type MeetingActionItem = {
  text: string;
  owner: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  evidenceUtteranceIds: string[];
};

export type MeetingNotesSnapshot = {
  summary: string;
  discussion: MeetingEvidenceItem[];
  decisions: MeetingEvidenceItem[];
  actionItems: MeetingActionItem[];
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const DEFAULT_MEETING_NOTES_MODEL = "gpt-5.4-mini";
const EMPTY_SUMMARY_PATTERNS = [
  "내용이 부족",
  "정보가 부족",
  "충분한 정보가 없",
  "요약할 내용이 부족",
  "회의 내용이 부족",
  "정리할 내용이 부족",
  "판단하기 어렵",
];

function getMeetingNotesModel() {
  const configured = process.env.MEETING_NOTES_MODEL?.trim();
  return configured || DEFAULT_MEETING_NOTES_MODEL;
}

function sanitizeEvidenceIds(input: unknown, allowedUtteranceIds?: Set<string>): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => {
      if (!value) return false;
      return allowedUtteranceIds ? allowedUtteranceIds.has(value) : true;
    });
}

function sanitizeEvidenceItems(
  input: unknown,
  allowedUtteranceIds?: Set<string>,
): MeetingEvidenceItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => {
      if (typeof value === "string") {
        const text = value.trim();
        if (!text) return null;

        return {
          title: null,
          text,
          detail: null,
          evidenceUtteranceIds: [],
        };
      }

      if (!value || typeof value !== "object") return null;
      const candidate = value as Record<string, unknown>;
      const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
      const rawText = typeof candidate.text === "string" ? candidate.text.trim() : "";
      const rawDetail = typeof candidate.detail === "string" ? candidate.detail.trim() : "";
      const text = rawText || rawDetail || title;
      if (!text) return null;

      return {
        title: title || null,
        text,
        detail: rawDetail && rawDetail !== text ? rawDetail : null,
        evidenceUtteranceIds: sanitizeEvidenceIds(candidate.evidenceUtteranceIds, allowedUtteranceIds),
      };
    })
    .filter((value): value is MeetingEvidenceItem => value !== null);
}

function sanitizeActionItems(
  input: unknown,
  allowedUtteranceIds?: Set<string>,
): MeetingActionItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => {
      if (!value || typeof value !== "object") return null;
      const candidate = value as Record<string, unknown>;
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (!text) return null;

      return {
        text,
        owner: typeof candidate.owner === "string" ? candidate.owner.trim() : null,
        status: typeof candidate.status === "string" ? candidate.status.trim() : null,
        priority: typeof candidate.priority === "string" ? candidate.priority.trim() : null,
        dueDate: typeof candidate.dueDate === "string" ? candidate.dueDate.trim() : null,
        evidenceUtteranceIds: sanitizeEvidenceIds(candidate.evidenceUtteranceIds, allowedUtteranceIds),
      };
    })
    .filter((value): value is MeetingActionItem => value !== null);
}

function sanitizeSummaryText(input: unknown) {
  const summary = typeof input === "string" ? input.trim() : "";
  if (!summary) return "";

  const normalized = summary.replace(/\s+/g, " ");
  if (EMPTY_SUMMARY_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return "";
  }

  return summary;
}

export function normalizeMeetingNotesSnapshot(
  input: unknown,
  options?: {
    allowedUtteranceIds?: string[];
  },
): MeetingNotesSnapshot {
  const candidate = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const allowedUtteranceIds = options?.allowedUtteranceIds
    ? new Set(options.allowedUtteranceIds)
    : undefined;

  return {
    summary: sanitizeSummaryText(candidate.summary),
    discussion: sanitizeEvidenceItems(candidate.discussion, allowedUtteranceIds),
    decisions: sanitizeEvidenceItems(candidate.decisions, allowedUtteranceIds),
    actionItems: sanitizeActionItems(candidate.actionItems, allowedUtteranceIds),
  };
}

function stringifyPreviousSnapshot(snapshot: MeetingNotesSnapshot | null) {
  if (!snapshot) return "없음";
  return JSON.stringify(snapshot, null, 2);
}

export async function generateMeetingNotesSnapshot(params: {
  transcript: string;
  previousSnapshot: MeetingNotesSnapshot | null;
  availableUtteranceIds?: string[];
  sessionTitle?: string | null;
  speakerNames?: string[];
}): Promise<MeetingNotesSnapshot> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const completion = await openai.chat.completions.create({
    model: getMeetingNotesModel(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          [
            "너는 사내 회의록을 작성하는 수석 PM/기획 비서다.",
            "항상 JSON 객체만 반환하고, 설명문이나 코드 블록은 절대 붙이지 마라.",
            "회의록은 뭉뚱그린 요약이 아니라 실제 회사 회의록처럼 구체적이고 구조적으로 작성한다.",
            "summary는 4~7문장으로 작성하고, 배경, 핵심 논의, 최종 결정, 남은 리스크를 포함한다.",
            "discussion과 decisions는 각각 {title, text, detail, evidenceUtteranceIds[]} 객체 배열이다.",
            "discussion.title은 논의 주제를 짧게 요약하고, text는 한 줄 핵심, detail은 2~5문장 수준의 구체 설명이다.",
            "decisions.title은 결정 주제를 짧게 요약하고, text는 실제로 결정된 내용 한 줄, detail은 결정 이유/영향/조건을 1~3문장으로 쓴다.",
            "actionItems는 {text, owner, status, priority, dueDate, evidenceUtteranceIds[]} 객체 배열이다.",
            "actionItems.text는 실행 가능한 작업 문장으로 쓰고, owner는 알 수 없으면 null, status는 todo/in_progress/done/blocked 중 하나 또는 null, priority는 high/medium/low 또는 null, dueDate는 YYYY-MM-DD 또는 null로 작성한다.",
            "evidenceUtteranceIds에는 transcript에 등장한 발화 ID만 넣고, 항목당 1~3개 이내로 유지한다.",
            "추측하지 말고 근거 없는 정보는 쓰지 마라. 내용이 부족하면 설명하지 말고 summary는 빈 문자열로, discussion/decisions/actionItems는 빈 배열로 둔다.",
            "중복을 줄이고 이미 확정된 내용을 유지하며, 한국어로 작성한다.",
            "가능하면 표현을 더 업무 문서답게 다듬고, '논의했다', '얘기했다'처럼 빈약한 표현 대신 실제 안건과 결론을 적는다.",
            "'내용이 부족하다', '정보가 부족하다', '판단이 어렵다' 같은 메타 설명 문장은 절대 쓰지 마라.",
          ].join(" "),
      },
      {
        role: "user",
        content: [
          `회의 제목:`,
          params.sessionTitle?.trim() || "없음",
          ``,
          `화자 목록:`,
          params.speakerNames && params.speakerNames.length > 0 ? params.speakerNames.join(", ") : "없음",
          ``,
          `이전 스냅샷:`,
          stringifyPreviousSnapshot(params.previousSnapshot),
          ``,
          `신규까지 포함한 누적 대본:`,
          params.transcript,
          ``,
          `사용 가능한 발화 ID:`,
          JSON.stringify(params.availableUtteranceIds ?? []),
          ``,
          `다음 JSON 스키마를 지켜라:`,
          `{"summary":"","discussion":[{"title":"","text":"","detail":"","evidenceUtteranceIds":[""]}],"decisions":[{"title":"","text":"","detail":"","evidenceUtteranceIds":[""]}],"actionItems":[{"text":"","owner":"","status":"","priority":"","dueDate":"","evidenceUtteranceIds":[""]}]}`,
          `추가 지침: summary와 detail은 문장형으로 자연스럽게 쓰고, discussion/decisions는 가능한 한 안건 단위로 묶어라. actionItems는 실제 담당자가 바로 실행할 수 있게 구체적으로 적어라.`,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";

  try {
    return normalizeMeetingNotesSnapshot(JSON.parse(content), {
      allowedUtteranceIds: params.availableUtteranceIds,
    });
  } catch {
    return {
      summary: "",
      discussion: [],
      decisions: [],
      actionItems: [],
    };
  }
}

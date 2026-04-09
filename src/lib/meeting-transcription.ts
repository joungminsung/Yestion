import OpenAI from "openai";

export type MeetingTranscriptSegment = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

export type MeetingTranscriptContextUtterance = {
  id?: string;
  speakerLabel: string;
  displayName?: string | null;
  text: string;
  startMs: number;
  endMs: number;
};

export type MeetingTranscriptionInput = {
  file: File;
  prompt?: string;
};

export type MeetingTranscriptionProvider = {
  transcribeChunk: (input: MeetingTranscriptionInput) => Promise<MeetingTranscriptSegment[]>;
};

const DEFAULT_TRANSCRIPTION_LANGUAGE = "ko";
const DEFAULT_TRANSCRIPTION_CONTEXT_UTTERANCE_LIMIT = 4;
const DEFAULT_TRANSCRIPTION_CONTEXT_CHAR_LIMIT = 360;
const GENERIC_SPEAKER_LABEL = /^speaker_\d+$/;

function normalizeSpeakerLabel(input: string | undefined, fallbackIndex: number) {
  const label = input?.trim();
  if (!label) {
    return `speaker_${fallbackIndex + 1}`;
  }
  return label.toLowerCase().replace(/\s+/g, "_");
}

function getMeetingTranscriptionLanguage() {
  const configured = process.env.MEETING_TRANSCRIPTION_LANGUAGE?.trim();
  return configured || DEFAULT_TRANSCRIPTION_LANGUAGE;
}

function getMeetingTranscriptionGlossary() {
  return (process.env.MEETING_TRANSCRIPTION_GLOSSARY ?? "")
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function getMeetingTranscriptionReplacementEntries() {
  const raw = process.env.MEETING_TRANSCRIPTION_REPLACEMENTS ?? "";

  return raw
    .split(/\n|,(?=[^,]+=|[^,]+=>)/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [from, to] = entry.includes("=>")
        ? entry.split("=>")
        : entry.split("=");
      return {
        from: from?.trim() ?? "",
        to: to?.trim() ?? "",
      };
    })
    .filter((entry) => entry.from.length > 0 && entry.to.length > 0);
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTranscriptText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([(\[{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .trim();
}

function applyTranscriptCorrections(text: string) {
  let nextText = normalizeTranscriptText(text);

  for (const entry of getMeetingTranscriptionReplacementEntries()) {
    nextText = nextText.replace(new RegExp(escapeRegExp(entry.from), "gi"), entry.to);
  }

  return nextText.trim();
}

function joinSegmentText(previous: string, next: string, gapSeconds: number) {
  const left = previous.trim();
  const right = next.trim();
  if (!left) return right;
  if (!right) return left;

  const leftEndsWithBoundary = /[\s.!?。！？,،;:]$/.test(left);
  const rightStartsWithBoundary = /^[,.;:!?)]/.test(right);

  if (leftEndsWithBoundary || rightStartsWithBoundary) {
    return `${left}${rightStartsWithBoundary ? "" : " "}${right}`.trim();
  }

  if (gapSeconds <= 0.2) {
    return `${left}${right}`;
  }

  return `${left} ${right}`.trim();
}

function mergeTranscriptSegments(segments: MeetingTranscriptSegment[]) {
  return segments.reduce<MeetingTranscriptSegment[]>((merged, segment) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ ...segment });
      return merged;
    }

    const gapSeconds = Math.max(0, segment.start - previous.end);
    const shouldMerge =
      previous.speaker === segment.speaker
      && gapSeconds <= 1.5
      && previous.text.length + segment.text.length <= 420
      && !/[.!?。！？]$/.test(previous.text.trim());

    if (!shouldMerge) {
      merged.push({ ...segment });
      return merged;
    }

    previous.end = Math.max(previous.end, segment.end);
    previous.text = joinSegmentText(previous.text, segment.text, gapSeconds);
    return merged;
  }, []);
}

function compactContextTail(text: string, limit = DEFAULT_TRANSCRIPTION_CONTEXT_CHAR_LIMIT) {
  const normalized = normalizeTranscriptText(text);
  if (normalized.length <= limit) {
    return normalized;
  }
  return `…${normalized.slice(-limit)}`;
}

function speakerDisplayName(utterance: MeetingTranscriptContextUtterance) {
  return utterance.displayName?.trim() || utterance.speakerLabel;
}

function normalizeComparisonText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripRepeatedPrefix(previousText: string, currentText: string) {
  const previousTokens = normalizeComparisonText(previousText).split(" ").filter(Boolean);
  const currentTokens = normalizeComparisonText(currentText).split(" ").filter(Boolean);

  if (previousTokens.length === 0 || currentTokens.length === 0) {
    return currentText.trim();
  }

  const maxOverlap = Math.min(7, previousTokens.length, currentTokens.length);
  let overlap = 0;
  for (let size = maxOverlap; size >= 2; size -= 1) {
    const left = previousTokens.slice(-size).join(" ");
    const right = currentTokens.slice(0, size).join(" ");
    if (left === right) {
      overlap = size;
      break;
    }
  }

  if (!overlap) {
    return currentText.trim();
  }

  const originalTokens = currentText.trim().split(/\s+/);
  return originalTokens.slice(Math.min(overlap, originalTokens.length)).join(" ").trim();
}

function shouldBridgeSpeaker(previous: MeetingTranscriptContextUtterance, firstSegment: MeetingTranscriptSegment, chunkStartedAtMs: number) {
  const firstAbsoluteStartMs = chunkStartedAtMs + Math.round(firstSegment.start * 1000);
  const gapMs = firstAbsoluteStartMs - previous.endMs;
  if (gapMs < -400 || gapMs > 1800) {
    return false;
  }

  if (!GENERIC_SPEAKER_LABEL.test(firstSegment.speaker)) {
    return false;
  }

  if (!/[.!?。！？]$/.test(previous.text.trim())) {
    return true;
  }

  return firstSegment.text.trim().length <= 18;
}

export function buildMeetingTranscriptionPrompt(recentUtterances: MeetingTranscriptContextUtterance[]) {
  const glossary = getMeetingTranscriptionGlossary();
  const limitedContext = recentUtterances.slice(-DEFAULT_TRANSCRIPTION_CONTEXT_UTTERANCE_LIMIT);

  const sections: string[] = [
    `Primary language: ${getMeetingTranscriptionLanguage()}.`,
    "This is a meeting transcript chunk. Continue naturally from the recent context without repeating already transcribed words.",
  ];

  if (glossary.length > 0) {
    sections.push(`Preferred terms: ${glossary.join(", ")}.`);
  }

  if (limitedContext.length > 0) {
    const contextLines = limitedContext.map((utterance) =>
      `${speakerDisplayName(utterance)}: ${compactContextTail(utterance.text)}`,
    );
    sections.push(`Recent context:\n${contextLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function stabilizeTranscriptSegments(
  segments: MeetingTranscriptSegment[],
  recentUtterances: MeetingTranscriptContextUtterance[],
  chunkStartedAtMs: number,
) {
  if (segments.length === 0) {
    return [];
  }

  const previous = recentUtterances[recentUtterances.length - 1];
  const speakerAliasMap = new Map<string, string>();

  if (previous && shouldBridgeSpeaker(previous, segments[0]!, chunkStartedAtMs)) {
    speakerAliasMap.set(segments[0]!.speaker, previous.speakerLabel);
  }

  return mergeTranscriptSegments(
    segments.map((segment, index) => {
      const nextSpeaker = speakerAliasMap.get(segment.speaker) ?? segment.speaker;
      const previousText = index === 0 ? previous?.text ?? "" : segments[index - 1]?.text ?? "";
      const dedupedText = index === 0
        ? stripRepeatedPrefix(previousText, segment.text)
        : segment.text;

      return {
        ...segment,
        speaker: nextSpeaker,
        text: applyTranscriptCorrections(dedupedText || segment.text),
      };
    }).filter((segment) => segment.text.length > 0),
  );
}

export function buildMergedUtteranceText(
  previous: MeetingTranscriptContextUtterance,
  segment: MeetingTranscriptSegment,
  chunkStartedAtMs: number,
) {
  const absoluteStartMs = chunkStartedAtMs + Math.round(segment.start * 1000);
  const gapMs = absoluteStartMs - previous.endMs;
  const nextText = stripRepeatedPrefix(previous.text, segment.text);

  if (!nextText) {
    return null;
  }

  const shouldMerge =
    previous.speakerLabel === segment.speaker
    && gapMs >= -400
    && gapMs <= 1800
    && previous.text.length + nextText.length <= 460
    && (
      gapMs <= 900
      || !/[.!?。！？]$/.test(previous.text.trim())
      || nextText.length <= 20
    );

  if (!shouldMerge) {
    return null;
  }

  return joinSegmentText(previous.text, nextText, Math.max(gapMs, 0) / 1000);
}

class OpenAiMeetingTranscriptionProvider implements MeetingTranscriptionProvider {
  private client: OpenAI | null;

  constructor() {
    this.client = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  async transcribeChunk(input: MeetingTranscriptionInput): Promise<MeetingTranscriptSegment[]> {
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const transcription = await this.client.audio.transcriptions.create({
      file: input.file,
      model: "gpt-4o-transcribe-diarize",
      response_format: "diarized_json",
      chunking_strategy: "auto",
      language: getMeetingTranscriptionLanguage(),
      prompt: input.prompt,
    } as never);

    const rawSegments = ((transcription as {
      segments?: Array<{
        speaker?: string;
        text?: string;
        start?: number;
        end?: number;
      }>;
    }).segments ?? []);

    const normalizedSegments = rawSegments
      .map((segment, index) => ({
        speaker: normalizeSpeakerLabel(segment.speaker, index),
        text: applyTranscriptCorrections(segment.text ?? ""),
        start: typeof segment.start === "number" ? segment.start : 0,
        end: typeof segment.end === "number" ? segment.end : 0,
      }))
      .filter((segment) => segment.text.length > 0);

    return mergeTranscriptSegments(normalizedSegments);
  }
}

function getMeetingTranscriptionProvider(): MeetingTranscriptionProvider {
  const provider = (process.env.MEETING_TRANSCRIPTION_PROVIDER ?? "openai").toLowerCase();

  switch (provider) {
    case "openai":
      return new OpenAiMeetingTranscriptionProvider();
    default:
      throw new Error(`Unsupported meeting transcription provider: ${provider}`);
  }
}

export async function transcribeMeetingChunk(input: MeetingTranscriptionInput): Promise<MeetingTranscriptSegment[]> {
  const provider = getMeetingTranscriptionProvider();
  return provider.transcribeChunk(input);
}

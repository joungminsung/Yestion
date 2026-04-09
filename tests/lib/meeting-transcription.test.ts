import { describe, expect, it } from "vitest";
import {
  buildMeetingTranscriptionPrompt,
  buildMergedUtteranceText,
  stabilizeTranscriptSegments,
  type MeetingTranscriptContextUtterance,
  type MeetingTranscriptSegment,
} from "@/lib/meeting-transcription";

describe("meeting-transcription helpers", () => {
  it("includes recent context in the transcription prompt", () => {
    const prompt = buildMeetingTranscriptionPrompt([
      {
        speakerLabel: "speaker_1",
        displayName: "민수",
        text: "오늘 회의에서는 배포 일정을 다시 봐야 합니다.",
        startMs: 0,
        endMs: 3000,
      },
    ]);

    expect(prompt).toContain("Primary language: ko.");
    expect(prompt).toContain("민수: 오늘 회의에서는 배포 일정을 다시 봐야 합니다.");
  });

  it("bridges generic speaker labels using recent context", () => {
    const recent: MeetingTranscriptContextUtterance[] = [
      {
        id: "u1",
        speakerLabel: "speaker_3",
        text: "오늘 나는",
        startMs: 0,
        endMs: 1200,
      },
    ];
    const segments: MeetingTranscriptSegment[] = [
      { speaker: "speaker_1", text: "밥을 먹었어", start: 0.05, end: 0.8 },
    ];

    const stabilized = stabilizeTranscriptSegments(segments, recent, 1500);

    expect(stabilized[0]?.speaker).toBe("speaker_3");
  });

  it("merges adjacent continuation text across chunk boundaries", () => {
    const merged = buildMergedUtteranceText(
      {
        id: "u1",
        speakerLabel: "speaker_1",
        text: "오늘 나는",
        startMs: 0,
        endMs: 1000,
      },
      {
        speaker: "speaker_1",
        text: "밥을 먹었어",
        start: 0.2,
        end: 0.9,
      },
      1100,
    );

    expect(merged).toBe("오늘 나는 밥을 먹었어");
  });
});

"use client";

export type AiAction =
  | "write"
  | "summarize"
  | "brainstorm"
  | "continue"
  | "makeLonger"
  | "makeShorter"
  | "fixGrammar"
  | "translate_en"
  | "translate_ko"
  | "changeTone_professional"
  | "changeTone_casual"
  | "extractPoints"
  | "makeTodos";

export type AiStreamPhase =
  | "preparing"
  | "analyzing"
  | "writing"
  | "finalizing";

export type AiStreamStatus = {
  type: "status";
  phase: AiStreamPhase;
  message: string;
  progress?: number;
};

type AiStreamText = {
  type: "text";
  text: string;
};

type AiStreamError = {
  type: "error";
  message: string;
};

type AiStreamPayload = AiStreamStatus | AiStreamText | AiStreamError;

type StreamAiResponseOptions = {
  prompt: string;
  context?: string;
  action: AiAction | string;
  signal?: AbortSignal;
  onText?: (text: string, fullText: string) => void;
  onStatus?: (status: AiStreamStatus) => void;
  onError?: (message: string) => void;
};

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || "AI 요청에 실패했습니다.";
  } catch {
    return response.statusText || "AI 요청에 실패했습니다.";
  }
}

function readSseEvents(buffer: string) {
  const chunks = buffer.split("\n\n");
  return {
    completeEvents: chunks.slice(0, -1),
    remainder: chunks[chunks.length - 1] ?? "",
  };
}

function readDataPayload(eventText: string) {
  return eventText
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .join("\n");
}

export async function streamAiResponse({
  prompt,
  context,
  action,
  signal,
  onText,
  onStatus,
  onError,
}: StreamAiResponseOptions) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: prompt || "위 내용을 처리해주세요.",
      context,
      action,
    }),
    signal,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    onError?.(message);
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const message = "AI 응답 스트림을 열지 못했습니다.";
    onError?.(message);
    throw new Error(message);
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  let isDone = false;

  while (!isDone) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { completeEvents, remainder } = readSseEvents(buffer);
    buffer = remainder;

    for (const eventText of completeEvents) {
      const payload = readDataPayload(eventText);
      if (!payload) {
        continue;
      }

      if (payload === "[DONE]") {
        isDone = true;
        break;
      }

      try {
        const data = JSON.parse(payload) as AiStreamPayload;
        if (data.type === "text") {
          fullText += data.text;
          onText?.(data.text, fullText);
        } else if (data.type === "status") {
          onStatus?.(data);
        } else if (data.type === "error") {
          onError?.(data.message);
          throw new Error(data.message);
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
      }
    }
  }

  return fullText;
}

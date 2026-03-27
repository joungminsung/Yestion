import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "@/server/auth/session";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, context, action } = await request.json();

    const defaultMessage = "You are a writing assistant. Write content based on the user's prompt. Output in Korean unless specified otherwise.";

    const systemMessages = new Map<string, string>([
      ["write", defaultMessage],
      ["summarize", "Summarize the following text concisely in Korean."],
      ["brainstorm", "Generate creative ideas and suggestions based on the topic. Output in Korean."],
      ["continue", "Continue writing from where the text left off, maintaining the same tone and style. Output in Korean."],
      ["makeLonger", "Expand and elaborate on the following text. Output in Korean."],
      ["makeShorter", "Condense the following text while keeping key information. Output in Korean."],
      ["fixGrammar", "Fix spelling and grammar errors in the following text. Output the corrected text only."],
      ["translate_en", "Translate the following text to English."],
      ["translate_ko", "Translate the following text to Korean."],
      ["changeTone_professional", "Rewrite in a professional tone. Output in Korean."],
      ["changeTone_casual", "Rewrite in a casual, friendly tone. Output in Korean."],
      ["extractPoints", "Extract key points from the following text as a bullet list. Output in Korean."],
      ["makeTodos", "Convert the following text into a to-do list. Output in Korean."],
    ]);

    const systemMessage = systemMessages.get(action) ?? defaultMessage;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        ...(context
          ? [{ role: "user" as const, content: `Context:\n${context}` }]
          : []),
        { role: "user", content: prompt },
      ],
      stream: true,
      max_tokens: 2000,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

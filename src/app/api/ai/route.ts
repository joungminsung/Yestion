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

    const defaultMessage = `당신은 Yestion 문서 작성 AI 어시스턴트입니다.

역할:
- 사용자의 요청에 따라 구조화된 문서 콘텐츠를 생성합니다
- Markdown 형식으로 작성하며, 제목(##, ###), 목록(-, *), 체크리스트(- [ ]), 인용(>), 코드블록(\`\`\`) 등을 적극 활용합니다
- 한국어로 작성하되, 전문 용어는 영어 병기 가능합니다

작성 원칙:
- 명확하고 간결한 문장을 사용합니다
- 적절한 소제목으로 구조를 잡습니다
- 실용적이고 바로 사용 가능한 콘텐츠를 생성합니다
- 빈 placeholder 대신 실제 예시 데이터를 포함합니다
- 문맥에 맞는 이모지를 제목에 활용합니다`;

    const systemMessages = new Map<string, string>([
      ["write", defaultMessage],
      ["summarize", `${defaultMessage}\n\n지금부터 주어진 텍스트를 핵심 내용 위주로 간결하게 요약합니다. 불필요한 수식어를 제거하고, 핵심 포인트를 불릿 목록으로 정리합니다.`],
      ["brainstorm", `${defaultMessage}\n\n지금부터 주어진 주제에 대해 창의적인 아이디어를 생성합니다. 각 아이디어에 간단한 설명과 실행 방안을 포함합니다. 최소 5개 이상의 아이디어를 제안합니다.`],
      ["continue", `${defaultMessage}\n\n지금부터 주어진 텍스트의 맥락, 어조, 스타일을 유지하면서 자연스럽게 이어서 작성합니다. 기존 내용과 중복되지 않는 새로운 내용을 추가합니다.`],
      ["makeLonger", `${defaultMessage}\n\n지금부터 주어진 텍스트를 더 상세하게 확장합니다. 구체적인 예시, 부연 설명, 세부 사항을 추가하되 핵심 메시지는 유지합니다.`],
      ["makeShorter", `${defaultMessage}\n\n지금부터 주어진 텍스트를 핵심만 남기고 압축합니다. 중복 표현을 제거하고 간결한 문장으로 재작성합니다.`],
      ["fixGrammar", "주어진 텍스트의 맞춤법, 문법, 띄어쓰기 오류를 수정합니다. 수정된 텍스트만 출력하고, 원문의 의미와 스타일은 유지합니다."],
      ["translate_en", "Translate the following Korean text to natural, fluent English. Maintain the original structure and formatting (headings, lists, etc.)."],
      ["translate_ko", "다음 영문 텍스트를 자연스러운 한국어로 번역합니다. 원문의 구조와 서식(제목, 목록 등)을 유지합니다."],
      ["changeTone_professional", `${defaultMessage}\n\n지금부터 주어진 텍스트를 공식적이고 전문적인 비즈니스 어조로 재작성합니다. 존댓말을 사용하고, 정중하면서도 명확한 표현을 사용합니다.`],
      ["changeTone_casual", `${defaultMessage}\n\n지금부터 주어진 텍스트를 친근하고 편안한 어조로 재작성합니다. 딱딱한 표현을 부드럽게 바꾸되, 핵심 내용은 유지합니다.`],
      ["extractPoints", `${defaultMessage}\n\n지금부터 주어진 텍스트에서 핵심 포인트를 추출하여 불릿 목록으로 정리합니다. 각 포인트는 한 문장으로 요약합니다.`],
      ["makeTodos", `${defaultMessage}\n\n지금부터 주어진 텍스트를 실행 가능한 할 일 목록으로 변환합니다. 각 항목은 구체적인 행동으로 작성하고, 우선순위나 기한이 있으면 포함합니다. 체크리스트 형식(- [ ])을 사용합니다.`],
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

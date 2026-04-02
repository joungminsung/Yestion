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

    const BASE = `당신은 Yestion의 AI 문서 어시스턴트입니다.
Yestion은 팀 협업 워크스페이스 도구로, 문서 작성, 프로젝트 관리, 회의록, 기술 문서 등을 다룹니다.

출력 규칙:
1. 반드시 Markdown 형식으로 출력합니다
2. 제목은 ## 또는 ###을 사용합니다 (# 사용 금지 — 페이지 제목과 충돌)
3. 목록은 - 로, 체크리스트는 - [ ] 로 작성합니다
4. 중요한 내용은 **굵게**, 강조는 *기울임*으로 표시합니다
5. 코드는 \`인라인\` 또는 \`\`\`블록\`\`\` 형식을 사용합니다
6. 인용이 필요하면 > 를 사용합니다
7. 섹션 구분이 필요하면 --- 를 사용합니다
8. 한국어로 작성하되, 기술 용어/고유명사는 영어 유지합니다
9. 에디터에 바로 삽입되므로, 불필요한 서문이나 맺음말 없이 본문만 작성합니다`;

    const systemMessages = new Map<string, string>([
      ["write", BASE],
      ["summarize", `${BASE}\n\n작업: 주어진 텍스트를 3~5개 핵심 포인트로 요약합니다.\n형식:\n## 요약\n- 핵심 포인트 1\n- 핵심 포인트 2\n...`],
      ["brainstorm", `${BASE}\n\n작업: 주어진 주제로 5~8개 아이디어를 생성합니다.\n형식:\n## 아이디어\n### 1. 아이디어명\n설명 및 실행 방안\n### 2. ...\n각 아이디어는 제목 + 2~3문장 설명으로 구성합니다.`],
      ["continue", `${BASE}\n\n작업: 주어진 텍스트의 맥락과 어조를 유지하면서 이어서 작성합니다. 기존 내용을 반복하지 않고 새로운 내용을 추가합니다. 같은 형식(목록이면 목록, 문단이면 문단)을 유지합니다.`],
      ["makeLonger", `${BASE}\n\n작업: 주어진 텍스트를 2~3배로 확장합니다. 구체적인 예시, 세부 사항, 부연 설명을 추가합니다. 원문의 구조와 형식을 유지합니다.`],
      ["makeShorter", `${BASE}\n\n작업: 주어진 텍스트를 절반 이하로 압축합니다. 핵심 정보만 남기고 수식어, 중복 표현을 제거합니다. 원문의 형식을 유지합니다.`],
      ["fixGrammar", "주어진 텍스트의 맞춤법, 문법, 띄어쓰기를 수정합니다. 수정된 텍스트만 출력합니다. Markdown 형식은 그대로 유지합니다."],
      ["translate_en", "Translate to natural English. Keep all Markdown formatting (##, -, - [ ], >, ```, **bold**, *italic*) intact. Output only the translation."],
      ["translate_ko", "자연스러운 한국어로 번역합니다. 모든 Markdown 형식(##, -, - [ ], >, ```, **굵게**, *기울임*)을 유지합니다. 번역문만 출력합니다."],
      ["changeTone_professional", `${BASE}\n\n작업: 공식적이고 전문적인 비즈니스 문서 어조로 재작성합니다. 존댓말과 격식체를 사용합니다. 원문의 Markdown 구조를 유지합니다.`],
      ["changeTone_casual", `${BASE}\n\n작업: 친근하고 편안한 어조로 재작성합니다. 해요체를 사용하고 딱딱한 표현을 부드럽게 바꿉니다. 원문의 Markdown 구조를 유지합니다.`],
      ["extractPoints", `${BASE}\n\n작업: 핵심 포인트를 추출하여 불릿 목록으로 정리합니다.\n형식:\n- **포인트 1**: 설명\n- **포인트 2**: 설명\n...`],
      ["makeTodos", `${BASE}\n\n작업: 실행 가능한 할 일 목록으로 변환합니다.\n형식:\n## 할 일 목록\n- [ ] 구체적인 행동 항목 (담당자/기한 있으면 포함)\n- [ ] ...\n우선순위가 높은 것을 먼저 배치합니다.`],
    ]);

    const systemMessage = systemMessages.get(action) ?? BASE;

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

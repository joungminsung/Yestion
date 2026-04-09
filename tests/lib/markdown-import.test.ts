import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "@/lib/markdown-import";

describe("markdownToBlocks", () => {
  it("joins soft-wrapped lines into a single paragraph", () => {
    const blocks = markdownToBlocks("오늘 나는 밥을 먹었어\n그리고 커피도 마셨어");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "오늘 나는 밥을 먹었어 그리고 커피도 마셨어" }],
    });
  });

  it("groups task list items into one task list block", () => {
    const blocks = markdownToBlocks("- [ ] 회의록 정리\n- [x] 공유하기");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("taskList");
    expect(blocks[0]?.content).toHaveLength(2);
    expect(blocks[0]?.content?.[0]).toMatchObject({
      type: "taskItem",
      attrs: { checked: false },
    });
    expect(blocks[0]?.content?.[1]).toMatchObject({
      type: "taskItem",
      attrs: { checked: true },
    });
  });

  it("separates paragraphs only on blank lines", () => {
    const blocks = markdownToBlocks("첫 문단 첫 줄\n첫 문단 둘째 줄\n\n둘째 문단");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "첫 문단 첫 줄 첫 문단 둘째 줄" }],
    });
    expect(blocks[1]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "둘째 문단" }],
    });
  });
});

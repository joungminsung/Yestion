import { describe, it, expect } from "vitest";
import { tiptapToBlocks, blocksToTiptap } from "@/components/editor/utils/block-serializer";

describe("block-serializer", () => {
  it("should convert tiptap paragraph to block", () => {
    const tiptap = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
    const blocks = tiptapToBlocks(tiptap, "page-1");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].pageId).toBe("page-1");
  });

  it("should convert heading", () => {
    const tiptap = { type: "doc" as const, content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] }] };
    const blocks = tiptapToBlocks(tiptap, "p1");
    expect(blocks[0].type).toBe("heading_1");
  });

  it("should convert blocks back to tiptap", () => {
    const blocks = [{ id: "b1", pageId: "p1", parentId: null, type: "paragraph" as const, content: { tiptapNode: { type: "paragraph", content: [{ type: "text", text: "Hello" }] } }, position: 0 }];
    const tiptap = blocksToTiptap(blocks);
    expect(tiptap.type).toBe("doc");
    expect(tiptap.content[0].type).toBe("paragraph");
  });

  it("should roundtrip", () => {
    const original = { type: "doc" as const, content: [
      { type: "paragraph", content: [{ type: "text", text: "Bold ", marks: [{ type: "bold" }] }, { type: "text", text: "normal" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
    ]};
    const blocks = tiptapToBlocks(original, "p1");
    const result = blocksToTiptap(blocks);
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe("paragraph");
    expect(result.content[1].type).toBe("heading");
  });
});

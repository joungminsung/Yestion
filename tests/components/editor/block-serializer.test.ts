import { describe, it, expect } from "vitest";
import {
  tiptapToBlocks,
  blocksToTiptap,
} from "@/components/editor/utils/block-serializer";
import type { RichTextSegment } from "@/types/editor";

describe("block-serializer", () => {
  it("should convert tiptap paragraph to normalized richText format", () => {
    const tiptap = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    const blocks = tiptapToBlocks(tiptap, "page-1");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("paragraph");
    expect(blocks[0]!.pageId).toBe("page-1");

    // Should use normalized richText, NOT tiptapNode
    const content = blocks[0]!.content as { richText: RichTextSegment[] };
    expect(content).not.toHaveProperty("tiptapNode");
    expect(content.richText).toHaveLength(1);
    expect(content.richText[0]!.text).toBe("Hello");
    expect(content.richText[0]!.annotations.bold).toBe(false);
  });

  it("should map bold marks to annotations.bold: true", () => {
    const tiptap = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const blocks = tiptapToBlocks(tiptap, "p1");
    const content = blocks[0]!.content as { richText: RichTextSegment[] };
    expect(content.richText[0]!.annotations.bold).toBe(true);
    expect(content.richText[0]!.annotations.italic).toBe(false);
  });

  it("should convert heading with level", () => {
    const tiptap = {
      type: "doc" as const,
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    const blocks = tiptapToBlocks(tiptap, "p1");
    expect(blocks[0]!.type).toBe("heading_2");
    const content = blocks[0]!.content as {
      richText: RichTextSegment[];
      level: number;
    };
    expect(content.level).toBe(2);
    expect(content.richText[0]!.text).toBe("Title");
  });

  it("should convert code block to normalized format", () => {
    const tiptap = {
      type: "doc" as const,
      content: [
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: 'const x = 1;' }],
        },
      ],
    };
    const blocks = tiptapToBlocks(tiptap, "p1");
    expect(blocks[0]!.type).toBe("code");
    const content = blocks[0]!.content as { code: string; language: string };
    expect(content.code).toBe("const x = 1;");
    expect(content.language).toBe("typescript");
    expect(content).not.toHaveProperty("tiptapNode");
  });

  it("should convert divider to empty content", () => {
    const tiptap = {
      type: "doc" as const,
      content: [{ type: "horizontalRule" }],
    };
    const blocks = tiptapToBlocks(tiptap, "p1");
    expect(blocks[0]!.type).toBe("divider");
    expect(blocks[0]!.content).toEqual({});
  });

  it("should use tiptapNode fallback for complex types (bulletList)", () => {
    const bulletList = {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "item" }] },
          ],
        },
      ],
    };
    const tiptap = { type: "doc" as const, content: [bulletList] };
    const blocks = tiptapToBlocks(tiptap, "p1");
    expect(blocks[0]!.type).toBe("bulleted_list");
    const content = blocks[0]!.content as { tiptapNode: unknown };
    expect(content.tiptapNode).toBeDefined();
  });

  it("should use index-based position (no module-level counter)", () => {
    const tiptap = {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A" }] },
        { type: "paragraph", content: [{ type: "text", text: "B" }] },
      ],
    };
    // Call twice to ensure no counter leak between calls
    tiptapToBlocks(tiptap, "p1");
    const blocks = tiptapToBlocks(tiptap, "p2");
    expect(blocks[0]!.position).toBe(0);
    expect(blocks[1]!.position).toBe(1);
  });

  it("should convert blocks back to tiptap (normalized format)", () => {
    const blocks = [
      {
        id: "b1",
        pageId: "p1",
        parentId: null,
        type: "paragraph" as const,
        content: {
          richText: [
            {
              text: "Hello",
              annotations: {
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
                code: false,
                color: "default",
              },
            },
          ],
        },
        position: 0,
      },
    ];
    const tiptap = blocksToTiptap(blocks);
    expect(tiptap.type).toBe("doc");
    expect(tiptap.content[0]!.type).toBe("paragraph");
    expect(tiptap.content[0]!.content).toHaveLength(1);
    expect(tiptap.content[0]!.content![0]!.text).toBe("Hello");
  });

  it("should roundtrip paragraph with formatting", () => {
    const original = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold ", marks: [{ type: "bold" }] },
            { type: "text", text: "normal" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading" }],
        },
      ],
    };
    const blocks = tiptapToBlocks(original, "p1");
    const result = blocksToTiptap(blocks);

    expect(result.content).toHaveLength(2);
    expect(result.content[0]!.type).toBe("paragraph");
    expect(result.content[1]!.type).toBe("heading");
    expect(result.content[1]!.attrs?.level).toBe(2);

    // Verify bold mark roundtrip
    const para = result.content[0]!;
    expect(para.content).toHaveLength(2);
    expect(para.content![0]!.text).toBe("Bold ");
    expect(para.content![0]!.marks).toEqual([{ type: "bold" }]);
    expect(para.content![1]!.text).toBe("normal");
    expect(para.content![1]!.marks).toBeUndefined();
  });

  it("should roundtrip code block", () => {
    const original = {
      type: "doc" as const,
      content: [
        {
          type: "codeBlock",
          attrs: { language: "python" },
          content: [{ type: "text", text: "print('hi')" }],
        },
      ],
    };
    const blocks = tiptapToBlocks(original, "p1");
    const result = blocksToTiptap(blocks);
    expect(result.content[0]!.type).toBe("codeBlock");
    expect(result.content[0]!.attrs?.language).toBe("python");
    expect(result.content[0]!.content![0]!.text).toBe("print('hi')");
  });

  it("should still support tiptapNode fallback in blocksToTiptap", () => {
    const blocks = [
      {
        id: "b1",
        pageId: "p1",
        parentId: null,
        type: "bulleted_list" as const,
        content: {
          tiptapNode: {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "item" }],
                  },
                ],
              },
            ],
          },
        },
        position: 0,
      },
    ];
    const tiptap = blocksToTiptap(blocks);
    expect(tiptap.content[0]!.type).toBe("bulletList");
    expect(tiptap.content[0]!.content).toHaveLength(1);
  });
});

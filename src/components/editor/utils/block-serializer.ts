import type { BlockData, BlockType, RichTextSegment, Annotation } from "@/types/editor";
import { DEFAULT_ANNOTATION } from "@/types/editor";

type TiptapMark = { type: string; attrs?: Record<string, unknown> };

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

export type TiptapDoc = { type: "doc"; content: TiptapNode[] };

// ---------- helpers ----------

const MARK_TO_ANNOTATION: Record<string, keyof Annotation> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikethrough",
  code: "code",
};

function marksToAnnotations(marks: TiptapMark[] | undefined): Annotation {
  const ann: Annotation = { ...DEFAULT_ANNOTATION };
  if (!marks) return ann;
  for (const mark of marks) {
    const key = MARK_TO_ANNOTATION[mark.type];
    if (key && key !== "color") {
      (ann as Record<string, unknown>)[key] = true;
    }
    if (mark.type === "textStyle" && mark.attrs?.color) {
      ann.color = mark.attrs.color as string;
    }
  }
  return ann;
}

function annotationsToMarks(ann: Annotation): TiptapMark[] {
  const marks: TiptapMark[] = [];
  if (ann.bold) marks.push({ type: "bold" });
  if (ann.italic) marks.push({ type: "italic" });
  if (ann.underline) marks.push({ type: "underline" });
  if (ann.strikethrough) marks.push({ type: "strike" });
  if (ann.code) marks.push({ type: "code" });
  if (ann.color && ann.color !== "default") {
    marks.push({ type: "textStyle", attrs: { color: ann.color } });
  }
  return marks;
}

function tiptapContentToRichText(content: TiptapNode[] | undefined): RichTextSegment[] {
  if (!content) return [];
  return content
    .filter((n) => n.type === "text" && n.text != null)
    .map((n) => {
      const seg: RichTextSegment = {
        text: n.text!,
        annotations: marksToAnnotations(n.marks),
      };
      // Extract link from marks
      const linkMark = n.marks?.find((m) => m.type === "link");
      if (linkMark?.attrs?.href) {
        seg.link = linkMark.attrs.href as string;
      }
      return seg;
    });
}

function richTextToTiptapContent(richText: RichTextSegment[]): TiptapNode[] {
  if (!richText || richText.length === 0) return [];
  return richText.map((seg) => {
    const marks = annotationsToMarks(seg.annotations);
    if (seg.link) {
      marks.push({ type: "link", attrs: { href: seg.link } });
    }
    const node: TiptapNode = { type: "text", text: seg.text };
    if (marks.length > 0) node.marks = marks;
    return node;
  });
}

// ---------- type mapping ----------

function tiptapTypeToBlockType(node: TiptapNode): BlockType {
  switch (node.type) {
    case "heading":
      return `heading_${(node.attrs?.level as number) ?? 1}` as BlockType;
    case "bulletList":
      return "bulleted_list";
    case "orderedList":
      return "numbered_list";
    case "taskList":
      return "to_do";
    case "blockquote":
      return "quote";
    case "codeBlock":
      return "code";
    case "horizontalRule":
      return "divider";
    case "image":
      return "image";
    case "table":
      return "table";
    default:
      return node.type as BlockType;
  }
}

// Block types that use the tiptapNode fallback (complex nested structures)
const FALLBACK_TYPES = new Set(["bulletList", "orderedList", "table", "taskList"]);

function extractContent(node: TiptapNode): Record<string, unknown> {
  // Complex / nested types -> fallback
  if (FALLBACK_TYPES.has(node.type)) {
    return { tiptapNode: node };
  }

  switch (node.type) {
    case "paragraph":
      return { richText: tiptapContentToRichText(node.content) };

    case "heading":
      return {
        richText: tiptapContentToRichText(node.content),
        level: (node.attrs?.level as number) ?? 1,
      };

    case "blockquote":
      // Blockquote in Tiptap wraps paragraphs; flatten to richText from first paragraph
      {
        const firstPara = node.content?.find((c) => c.type === "paragraph");
        return { richText: tiptapContentToRichText(firstPara?.content) };
      }

    case "codeBlock":
      {
        const codeText = node.content
          ?.filter((n) => n.type === "text")
          .map((n) => n.text ?? "")
          .join("") ?? "";
        return {
          code: codeText,
          language: (node.attrs?.language as string) ?? "",
        };
      }

    case "horizontalRule":
      return {};

    case "image":
      return {
        url: (node.attrs?.src as string) ?? "",
        ...(node.attrs?.alt ? { caption: node.attrs.alt as string } : {}),
        ...(node.attrs?.width ? { width: node.attrs.width as number } : {}),
      };

    default:
      // Unknown type -> fallback
      return { tiptapNode: node };
  }
}

// ---------- tiptapToBlocks ----------

export function tiptapToBlocks(doc: TiptapDoc, pageId: string): BlockData[] {
  if (!doc.content) return [];
  return doc.content.map((node, index) => ({
    id: (node.attrs?.blockId as string) || crypto.randomUUID(),
    pageId,
    parentId: null,
    type: tiptapTypeToBlockType(node),
    content: extractContent(node),
    position: index,
  }));
}

// ---------- blocksToTiptap ----------

function blockContentToTiptapNode(block: BlockData): TiptapNode {
  const content = block.content as Record<string, unknown>;

  // If stored with tiptapNode fallback, use it directly
  if (content.tiptapNode) {
    return content.tiptapNode as TiptapNode;
  }

  const richText = content.richText as RichTextSegment[] | undefined;

  switch (block.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: richTextToTiptapContent(richText ?? []),
      };

    case "heading_1":
    case "heading_2":
    case "heading_3":
      {
        const level = (content.level as number) ?? parseInt(block.type.split("_")[1] ?? "1");
        return {
          type: "heading",
          attrs: { level },
          content: richTextToTiptapContent(richText ?? []),
        };
      }

    case "quote":
      return {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: richTextToTiptapContent(richText ?? []),
          },
        ],
      };

    case "code":
      return {
        type: "codeBlock",
        attrs: { language: (content.language as string) ?? "" },
        content: (content.code as string)
          ? [{ type: "text", text: content.code as string }]
          : [],
      };

    case "divider":
      return { type: "horizontalRule" };

    case "image":
      return {
        type: "image",
        attrs: {
          src: (content.url as string) ?? "",
          ...(content.caption ? { alt: content.caption as string } : {}),
          ...(content.width ? { width: content.width as number } : {}),
        },
      };

    default:
      {
        // Best-effort generic reconstruction
        const tiptapType = block.type === "bulleted_list" ? "bulletList"
          : block.type === "numbered_list" ? "orderedList"
          : block.type === "to_do" ? "taskList"
          : block.type;
        return { type: tiptapType };
      }
  }
}

export function blocksToTiptap(blocks: BlockData[]): TiptapDoc {
  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  return {
    type: "doc",
    content: sorted.map(blockContentToTiptapNode),
  };
}

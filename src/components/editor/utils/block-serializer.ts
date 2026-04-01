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
    case "videoBlock":
      return "video";
    case "audioBlock":
      return "audio";
    case "fileBlock":
      return "file";
    case "embed":
      return "embed";
    case "bookmark":
      return "bookmark";
    case "equation":
      return "equation";
    case "linkToPage":
      return "link_to_page";
    case "syncedBlock":
      return "synced_block";
    case "tableOfContents":
      return "table_of_contents";
    case "callout":
      return "callout";
    case "details":
      return "toggle";
    case "columnList":
      return "column_list";
    default:
      return node.type as BlockType;
  }
}

// Block types that use the tiptapNode fallback (complex nested structures)
const FALLBACK_TYPES = new Set(["bulletList", "orderedList", "table", "taskList", "details", "columnList"]);

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

    case "videoBlock":
      return {
        url: (node.attrs?.src as string) ?? "",
        title: (node.attrs?.title as string) ?? "",
      };

    case "audioBlock":
      return {
        url: (node.attrs?.src as string) ?? "",
        title: (node.attrs?.title as string) ?? "",
      };

    case "fileBlock":
      return {
        url: (node.attrs?.src as string) ?? "",
        name: (node.attrs?.name as string) ?? "",
        size: (node.attrs?.size as number) ?? 0,
        fileType: (node.attrs?.type as string) ?? "",
      };

    case "embed":
      return {
        url: (node.attrs?.url as string) ?? "",
        embedUrl: (node.attrs?.embedUrl as string) ?? "",
        provider: (node.attrs?.provider as string) ?? "",
        width: (node.attrs?.width as number) ?? 0,
        height: (node.attrs?.height as number) ?? 0,
      };

    case "bookmark":
      return {
        url: (node.attrs?.url as string) ?? "",
        title: (node.attrs?.title as string) ?? "",
        description: (node.attrs?.description as string) ?? "",
        image: (node.attrs?.image as string) ?? "",
        favicon: (node.attrs?.favicon as string) ?? "",
        siteName: (node.attrs?.siteName as string) ?? "",
      };

    case "equation":
      return {
        expression: (node.attrs?.expression as string) ?? "",
      };

    case "linkToPage":
      return {
        pageId: (node.attrs?.pageId as string) ?? "",
        pageTitle: (node.attrs?.pageTitle as string) ?? "",
        pageIcon: (node.attrs?.pageIcon as string) ?? "",
      };

    case "tableOfContents":
      return {};

    case "syncedBlock":
      return {
        sourceBlockId: (node.attrs?.sourceBlockId as string) ?? "",
        sourcePageId: (node.attrs?.sourcePageId as string) ?? "",
      };

    case "callout":
      return {
        icon: (node.attrs?.icon as string) ?? "",
        color: (node.attrs?.color as string) ?? "",
        richText: tiptapContentToRichText(node.content),
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

    case "video":
      return {
        type: "videoBlock",
        attrs: {
          src: (content.url as string) ?? "",
          title: (content.title as string) ?? "",
        },
      };

    case "audio":
      return {
        type: "audioBlock",
        attrs: {
          src: (content.url as string) ?? "",
          title: (content.title as string) ?? "",
        },
      };

    case "file":
      return {
        type: "fileBlock",
        attrs: {
          src: (content.url as string) ?? "",
          name: (content.name as string) ?? "",
          size: (content.size as number) ?? 0,
          type: (content.fileType as string) ?? "",
        },
      };

    case "embed":
      return {
        type: "embed",
        attrs: {
          url: (content.url as string) ?? "",
          embedUrl: (content.embedUrl as string) ?? "",
          provider: (content.provider as string) ?? "",
          width: (content.width as number) ?? 0,
          height: (content.height as number) ?? 0,
        },
      };

    case "bookmark":
      return {
        type: "bookmark",
        attrs: {
          url: (content.url as string) ?? "",
          title: (content.title as string) ?? "",
          description: (content.description as string) ?? "",
          image: (content.image as string) ?? "",
          favicon: (content.favicon as string) ?? "",
          siteName: (content.siteName as string) ?? "",
        },
      };

    case "equation":
      return {
        type: "equation",
        attrs: {
          expression: (content.expression as string) ?? "",
        },
      };

    case "link_to_page":
      return {
        type: "linkToPage",
        attrs: {
          pageId: (content.pageId as string) ?? "",
          pageTitle: (content.pageTitle as string) ?? "",
          pageIcon: (content.pageIcon as string) ?? "",
        },
      };

    case "table_of_contents":
      return {
        type: "tableOfContents",
      };

    case "synced_block":
      return {
        type: "syncedBlock",
        attrs: {
          sourceBlockId: (content.sourceBlockId as string) ?? "",
          sourcePageId: (content.sourcePageId as string) ?? "",
        },
      };

    case "callout":
      return {
        type: "callout",
        attrs: {
          icon: (content.icon as string) ?? "",
          color: (content.color as string) ?? "",
        },
        content: richTextToTiptapContent(richText ?? []),
      };

    default:
      {
        // Best-effort generic reconstruction
        const tiptapType = block.type === "bulleted_list" ? "bulletList"
          : block.type === "numbered_list" ? "orderedList"
          : block.type === "to_do" ? "taskList"
          : block.type === "toggle" ? "details"
          : block.type === "column_list" ? "columnList"
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

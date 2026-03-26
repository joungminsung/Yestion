import type { BlockData, BlockType } from "@/types/editor";

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type TiptapDoc = { type: "doc"; content: TiptapNode[] };

function tiptapTypeToBlockType(node: TiptapNode): BlockType {
  switch (node.type) {
    case "heading": return `heading_${(node.attrs?.level as number) ?? 1}` as BlockType;
    case "bulletList": return "bulleted_list";
    case "orderedList": return "numbered_list";
    case "taskList": return "to_do";
    case "blockquote": return "quote";
    case "codeBlock": return "code";
    case "horizontalRule": return "divider";
    case "image": return "image";
    case "table": return "table";
    default: return node.type as BlockType;
  }
}

let posCounter = 0;

export function tiptapToBlocks(doc: TiptapDoc, pageId: string): BlockData[] {
  posCounter = 0;
  if (!doc.content) return [];
  return doc.content.map((node) => ({
    id: (node.attrs?.blockId as string) || crypto.randomUUID(),
    pageId,
    parentId: null,
    type: tiptapTypeToBlockType(node),
    content: { tiptapNode: node },
    position: posCounter++,
  }));
}

export function blocksToTiptap(blocks: BlockData[]): TiptapDoc {
  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  return {
    type: "doc",
    content: sorted.map((block) => {
      const stored = block.content as { tiptapNode?: TiptapNode };
      if (stored.tiptapNode) return stored.tiptapNode;
      const tiptapType = block.type.startsWith("heading_") ? "heading" :
        block.type === "bulleted_list" ? "bulletList" : block.type === "numbered_list" ? "orderedList" :
        block.type === "to_do" ? "taskList" : block.type === "quote" ? "blockquote" :
        block.type === "code" ? "codeBlock" : block.type === "divider" ? "horizontalRule" : block.type;
      const node: TiptapNode = { type: tiptapType };
      if (block.type.startsWith("heading_")) node.attrs = { level: parseInt(block.type.split("_")[1] ?? "1") };
      return node;
    }),
  };
}

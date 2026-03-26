"use client";

import { useCallback, useRef } from "react";
import { NotionEditor } from "./editor";
import { tiptapToBlocks, blocksToTiptap, type TiptapDoc } from "./utils/block-serializer";
import { trpc } from "@/server/trpc/client";
import type { BlockType, BlockContent } from "@/types/editor";

type PageEditorProps = {
  pageId: string;
  initialBlocks: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
  isLocked?: boolean;
};

export function PageEditor({ pageId, initialBlocks, isLocked = false }: PageEditorProps) {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const bulkSave = trpc.block.bulkSave.useMutation();

  const initialContent = blocksToTiptap(
    initialBlocks.map((b) => ({ id: b.id, pageId, parentId: b.parentId, type: b.type as BlockType, content: b.content as BlockContent, position: b.position }))
  );

  const handleUpdate = useCallback((json: Record<string, unknown>) => {
    if (isLocked) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const blocks = tiptapToBlocks(json as unknown as TiptapDoc, pageId);
      bulkSave.mutate({
        pageId,
        blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content as Record<string, unknown>, position: b.position, parentId: b.parentId })),
      });
    }, 1000);
  }, [pageId, bulkSave, isLocked]);

  return (
    <NotionEditor
      initialContent={initialContent.content.length > 0 ? initialContent : undefined}
      onUpdate={handleUpdate}
      editable={!isLocked}
    />
  );
}

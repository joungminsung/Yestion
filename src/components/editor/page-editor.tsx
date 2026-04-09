"use client";

import { lazy, Suspense, useMemo } from "react";
import { blocksToTiptap } from "./utils/block-serializer";
import type { BlockType, BlockContent } from "@/types/editor";
import { Backlinks } from "./backlinks";
import { usePageSave } from "./use-page-save";
import { getCollaborationUrl } from "@/lib/collaboration/provider";

const NotionEditor = lazy(() => import("./editor").then(m => ({ default: m.NotionEditor })));
const CollaborativeEditor = lazy(() => import("./collaborative-editor").then(m => ({ default: m.CollaborativeEditor })));

type PageEditorProps = {
  pageId: string;
  initialBlocks: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
  isLocked?: boolean;
  sessionToken?: string;
  user?: { id: string; name: string };
  hasCollabState?: boolean;
};

export function PageEditor({
  pageId,
  initialBlocks,
  isLocked = false,
  sessionToken,
  user,
  hasCollabState = false,
}: PageEditorProps) {
  const initialContent = useMemo(() => (
    blocksToTiptap(
      initialBlocks.map((b) => ({ id: b.id, pageId, parentId: b.parentId, type: b.type as BlockType, content: b.content as BlockContent, position: b.position }))
    )
  ), [initialBlocks, pageId]);
  const initialSnapshot = useMemo(() => JSON.stringify(initialContent), [initialContent]);
  const { handleUpdate } = usePageSave({ pageId, isLocked, initialSnapshot });

  const editorSkeleton = (
    <div className="animate-pulse space-y-3 py-4">
      <div className="h-4 rounded w-3/4" style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }} />
      <div className="h-4 rounded w-1/2" style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }} />
      <div className="h-4 rounded w-5/6" style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }} />
    </div>
  );

  const collabUrl = getCollaborationUrl();
  const shouldUseCollaboration = Boolean(collabUrl && sessionToken && user);

  return (
    <>
      {/* Save status is now shown in the topbar */}

      {shouldUseCollaboration ? (
        <Suspense fallback={editorSkeleton}>
          <CollaborativeEditor
            pageId={pageId}
            sessionToken={sessionToken!}
            user={user!}
            isLocked={isLocked}
            initialBlocks={initialBlocks}
            onUpdate={handleUpdate}
            hasPersistedCollabState={hasCollabState}
          />
        </Suspense>
      ) : (
        <Suspense fallback={editorSkeleton}>
          <NotionEditor
            pageId={pageId}
            currentUser={user}
            initialContent={initialContent.content.length > 0 ? initialContent : undefined}
            onUpdate={handleUpdate}
            editable={!isLocked}
          />
        </Suspense>
      )}

      {pageId && <Backlinks pageId={pageId} />}
    </>
  );
}

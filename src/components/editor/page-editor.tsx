"use client";

import { useCallback, useRef, useEffect, useState, lazy, Suspense } from "react";
import { tiptapToBlocks, blocksToTiptap, type TiptapDoc } from "./utils/block-serializer";
import { trpc } from "@/server/trpc/client";
import type { BlockType, BlockContent } from "@/types/editor";
import { useToastStore } from "@/stores/toast";
import { Backlinks } from "./backlinks";

const NotionEditor = lazy(() => import("./editor").then(m => ({ default: m.NotionEditor })));
const CollaborativeEditor = lazy(() => import("./collaborative-editor").then(m => ({ default: m.CollaborativeEditor })));

type PageEditorProps = {
  pageId: string;
  initialBlocks: { id: string; type: string; content: unknown; position: number; parentId: string | null }[];
  isLocked?: boolean;
  sessionToken?: string;
  user?: { id: string; name: string };
};

export function PageEditor({ pageId, initialBlocks, isLocked = false, sessionToken, user }: PageEditorProps) {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const pendingJson = useRef<Record<string, unknown> | null>(null);
  const isSaving = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const addToast = useToastStore((s) => s.addToast);

  const bulkSave = trpc.block.bulkSave.useMutation({
    onSuccess: () => {
      isSaving.current = false;
      // If more changes accumulated while saving, save again
      if (pendingJson.current) {
        const json = pendingJson.current;
        pendingJson.current = null;
        flushSave(json);
      } else {
        setSaveStatus("saved");
      }
    },
    onError: (error) => {
      isSaving.current = false;
      setSaveStatus("error");
      addToast({ message: `저장 실패: ${error.message}`, type: "error" });
      // Retry once after 3 seconds
      if (pendingJson.current || lastJson.current) {
        setTimeout(() => {
          const json = pendingJson.current || lastJson.current;
          if (json) {
            pendingJson.current = null;
            flushSave(json);
          }
        }, 3000);
      }
    },
  });

  const lastJson = useRef<Record<string, unknown> | null>(null);

  const initialContent = blocksToTiptap(
    initialBlocks.map((b) => ({ id: b.id, pageId, parentId: b.parentId, type: b.type as BlockType, content: b.content as BlockContent, position: b.position }))
  );

  const flushSave = useCallback((json: Record<string, unknown>) => {
    if (isLocked) return;
    if (isSaving.current) {
      // Queue for after current save completes
      pendingJson.current = json;
      return;
    }
    isSaving.current = true;
    setSaveStatus("saving");
    const blocks = tiptapToBlocks(json as unknown as TiptapDoc, pageId);
    bulkSave.mutate({
      pageId,
      blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content as Record<string, unknown>, position: b.position, parentId: b.parentId })),
    });
  }, [pageId, bulkSave, isLocked]);

  const handleUpdate = useCallback((json: Record<string, unknown>) => {
    if (isLocked) return;
    lastJson.current = json;
    setSaveStatus("unsaved");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      flushSave(json);
    }, 500);
  }, [flushSave, isLocked]);

  // Flush on page unload (beforeunload) — use sendBeacon for reliability
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
      if (lastJson.current && saveStatus !== "saved") {
        // Synchronous save attempt via sendBeacon to dedicated endpoint
        const json = lastJson.current;
        const blocks = tiptapToBlocks(json as unknown as TiptapDoc, pageId);
        const payload = JSON.stringify({
          pageId,
          blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content, position: b.position, parentId: b.parentId })),
        });
        navigator.sendBeacon("/api/blocks-save", new Blob([payload], { type: "application/json" }));
      }
    };

    // Flush on visibility change (tab switch, mobile background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && lastJson.current && saveStatus !== "saved") {
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
          saveTimeout.current = null;
        }
        flushSave(lastJson.current);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Flush on unmount (page navigation within SPA)
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
      if (lastJson.current && !isSaving.current) {
        const json = lastJson.current;
        const blocks = tiptapToBlocks(json as unknown as TiptapDoc, pageId);
        bulkSave.mutate({
          pageId,
          blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content as Record<string, unknown>, position: b.position, parentId: b.parentId })),
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-bind on pageId change
  }, [pageId]);

  const editorSkeleton = (
    <div className="animate-pulse space-y-3 py-4">
      <div className="h-4 rounded w-3/4" style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }} />
      <div className="h-4 rounded w-1/2" style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }} />
      <div className="h-4 rounded w-5/6" style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }} />
    </div>
  );

  // Only use collaborative editor if collab server URL is explicitly configured
  const collabUrl = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_COLLAB_URL : undefined;
  if (collabUrl && sessionToken && user) {
    return (
      <Suspense fallback={editorSkeleton}>
        <CollaborativeEditor
          pageId={pageId}
          sessionToken={sessionToken}
          user={user}
          isLocked={isLocked}
          initialBlocks={initialBlocks}
        />
      </Suspense>
    );
  }

  return (
    <>
      {/* Save status indicator */}
      <div
        className="fixed top-2 right-3 z-50 flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-opacity"
        style={{
          opacity: saveStatus === "saved" ? 0 : 1,
          color: saveStatus === "error" ? "var(--color-red, #e03e3e)" : "var(--text-tertiary)",
          pointerEvents: "none",
        }}
      >
        {saveStatus === "saving" && (
          <>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--color-orange, #d9730d)" }} />
            저장 중...
          </>
        )}
        {saveStatus === "unsaved" && (
          <>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--text-tertiary)" }} />
            변경됨
          </>
        )}
        {saveStatus === "error" && (
          <>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-red, #e03e3e)" }} />
            저장 실패
          </>
        )}
      </div>
      <Suspense fallback={editorSkeleton}>
        <NotionEditor
          initialContent={initialContent.content.length > 0 ? initialContent : undefined}
          onUpdate={handleUpdate}
          editable={!isLocked}
        />
      </Suspense>
      {pageId && <Backlinks pageId={pageId} />}
    </>
  );
}

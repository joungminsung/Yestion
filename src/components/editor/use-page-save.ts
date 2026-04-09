"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tiptapToBlocks, type TiptapDoc } from "./utils/block-serializer";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { useSaveStatusStore } from "@/stores/save-status";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type SaveFeedback = {
  label: string;
  detail: string;
  progress: number;
  tone: "neutral" | "success" | "warning" | "error";
};
type SavePayload = {
  json: Record<string, unknown>;
  snapshot: string;
};

function toMutationBlocks(json: Record<string, unknown>, pageId: string) {
  const blocks = tiptapToBlocks(json as unknown as TiptapDoc, pageId);

  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    content: block.content as Record<string, unknown>,
    position: block.position,
    parentId: block.parentId,
  }));
}

function serializeDocument(json: Record<string, unknown> | null | undefined) {
  if (!json) return null;
  return JSON.stringify(json);
}

export function usePageSave({
  pageId,
  isLocked = false,
  initialSnapshot,
}: {
  pageId: string;
  isLocked?: boolean;
  initialSnapshot?: string | null;
}) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<SavePayload | null>(null);
  const lastSave = useRef<SavePayload | null>(null);
  const latestFlushRef = useRef<(strategy: "mutation" | "beacon") => void>(() => {});
  const lastObservedSnapshot = useRef<string | null>(initialSnapshot ?? null);
  const lastPersistedSnapshot = useRef<string | null>(initialSnapshot ?? null);
  const inFlightSnapshot = useRef<string | null>(null);
  const isSaving = useRef(false);
  const saveStatusRef = useRef<SaveStatus>("saved");
  const [saveStatus, setSaveStatusState] = useState<SaveStatus>("saved");
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({
    label: "모든 변경 사항 저장됨",
    detail: "문서가 최신 상태입니다.",
    progress: 100,
    tone: "success",
  });
  const addToast = useToastStore((state) => state.addToast);

  const setGlobalSaveStatus = useSaveStatusStore((s) => s.setStatus);
  const setSaveStatus = useCallback((nextStatus: SaveStatus) => {
    saveStatusRef.current = nextStatus;
    setSaveStatusState(nextStatus);
    setGlobalSaveStatus(nextStatus);
  }, [setGlobalSaveStatus]);

  const bulkSave = trpc.block.bulkSave.useMutation({
    onSuccess: () => {
      isSaving.current = false;
      if (inFlightSnapshot.current) {
        lastPersistedSnapshot.current = inFlightSnapshot.current;
      }
      inFlightSnapshot.current = null;

      if (pendingSave.current) {
        const nextSave = pendingSave.current;
        pendingSave.current = null;
        void flushSave(nextSave);
        return;
      }

      setSaveStatus("saved");
      setSaveFeedback({
        label: "모든 변경 사항 저장됨",
        detail: `${new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })}에 클라우드와 동기화했습니다.`,
        progress: 100,
        tone: "success",
      });
    },
    onError: (error) => {
      isSaving.current = false;
      setSaveStatus("error");
      setSaveFeedback({
        label: "저장에 실패했습니다",
        detail:
          pendingSave.current || lastSave.current
            ? "3초 후 자동으로 다시 시도합니다. 연결 상태를 확인해주세요."
            : "연결 상태를 확인한 뒤 다시 편집해보세요.",
        progress: 100,
        tone: "error",
      });
      addToast({ message: `저장 실패: ${error.message}`, type: "error" });

      if (pendingSave.current || lastSave.current) {
        setTimeout(() => {
          const nextSave = pendingSave.current ?? lastSave.current;
          if (!nextSave) return;

          pendingSave.current = null;
          void flushSave(nextSave);
        }, 3000);
      }
    },
  });

  const flushSave = useCallback(async (payload: SavePayload) => {
    if (isLocked) return;

    if (payload.snapshot === lastPersistedSnapshot.current) {
      pendingSave.current = null;
      setSaveStatus("saved");
      setSaveFeedback({
        label: "모든 변경 사항 저장됨",
        detail: "문서가 최신 상태입니다.",
        progress: 100,
        tone: "success",
      });
      return;
    }

    if (isSaving.current) {
      pendingSave.current = payload;
      return;
    }

    isSaving.current = true;
    inFlightSnapshot.current = payload.snapshot;
    setSaveStatus("saving");
    setSaveFeedback({
      label: "변경 사항 저장 중",
      detail: "작성한 내용을 클라우드에 안전하게 동기화하고 있습니다.",
      progress: 72,
      tone: "warning",
    });
    bulkSave.mutate({
      pageId,
      blocks: toMutationBlocks(payload.json, pageId),
    });
  }, [bulkSave, isLocked, pageId, setSaveStatus]);

  const flushViaBeacon = useCallback((payload: SavePayload) => {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return false;
    }

    const beaconPayload = JSON.stringify({
      pageId,
      blocks: toMutationBlocks(payload.json, pageId),
    });

    return navigator.sendBeacon(
      "/api/blocks-save",
      new Blob([beaconPayload], { type: "application/json" }),
    );
  }, [pageId]);

  const flushLatest = useCallback((strategy: "mutation" | "beacon") => {
    if (isLocked) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }

    const nextSave = pendingSave.current ?? lastSave.current;
    pendingSave.current = null;

    if (!nextSave) return;

    if (nextSave.snapshot === lastPersistedSnapshot.current) {
      return;
    }

    if (strategy === "beacon" && flushViaBeacon(nextSave)) {
      lastPersistedSnapshot.current = nextSave.snapshot;
      setSaveStatus("saved");
      setSaveFeedback({
        label: "페이지 이탈 직전 저장 완료",
        detail: "마지막 변경 사항까지 전송했습니다.",
        progress: 100,
        tone: "success",
      });
      return;
    }

    void flushSave(nextSave);
  }, [flushSave, flushViaBeacon, isLocked, setSaveStatus]);

  useEffect(() => {
    latestFlushRef.current = flushLatest;
  }, [flushLatest]);

  const handleUpdate = useCallback((json: Record<string, unknown>) => {
    if (isLocked) return;

    const snapshot = serializeDocument(json);
    if (!snapshot || snapshot === lastObservedSnapshot.current) {
      return;
    }

    lastObservedSnapshot.current = snapshot;
    lastSave.current = { json, snapshot };

    if (snapshot === lastPersistedSnapshot.current && !isSaving.current) {
      setSaveStatus("saved");
      setSaveFeedback({
        label: "모든 변경 사항 저장됨",
        detail: "문서가 최신 상태입니다.",
        progress: 100,
        tone: "success",
      });
      return;
    }

    setSaveStatus("unsaved");
    setSaveFeedback({
      label: "변경 사항이 감지되었습니다",
      detail: "입력이 멈추면 자동으로 저장됩니다.",
      progress: 28,
      tone: "neutral",
    });

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      void flushSave({ json, snapshot });
    }, 500);
  }, [flushSave, isLocked, setSaveStatus]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveStatusRef.current !== "saved") {
        latestFlushRef.current("beacon");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && saveStatusRef.current !== "saved") {
        latestFlushRef.current("mutation");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      latestFlushRef.current("mutation");
    };
  }, []);

  return {
    handleUpdate,
    saveStatus,
    saveFeedback,
  };
}

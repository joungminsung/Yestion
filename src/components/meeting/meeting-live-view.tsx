"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Loader2, FileText, Radio, Download, Save, Lock, AlertTriangle, Copy, Users, Play, Pause, ArrowUpRight, Database } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import type { AppRouter } from "@/server/trpc/router";
import { useMeetingRecorderStore } from "@/stores/meeting-recorder";
import { useToastStore } from "@/stores/toast";

type Props = {
  pageId: string;
  variant?: "inline" | "panel";
  hideWhenDisabled?: boolean;
};

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MeetingPageState = RouterOutputs["meeting"]["getPageState"];
type MeetingSessionData = NonNullable<MeetingPageState["session"]>;
type MeetingSpeaker = MeetingSessionData["speakers"][number];
type MeetingParticipant = MeetingSessionData["participants"][number];
type MeetingUtterance = MeetingSessionData["utterances"][number];

type MeetingMode = "single_recorder" | "multi_participant";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatUtteranceTime(startMs: number) {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR");
}

function joinTranscriptText(previous: string, next: string, gapMs: number) {
  const left = previous.trim();
  const right = next.trim();
  if (!left) return right;
  if (!right) return left;

  const leftEndsWithBoundary = /[\s.!?。！？]$/.test(left);
  const rightStartsWithBoundary = /^[,.;:!?)]/.test(right);

  if (leftEndsWithBoundary || rightStartsWithBoundary) {
    return `${left}${rightStartsWithBoundary ? "" : " "}${right}`.trim();
  }

  if (gapMs <= 220) {
    return `${left}${right}`;
  }

  return `${left} ${right}`;
}

function formatEvidenceHeading(title: string | null | undefined, text: string) {
  const normalizedTitle = title?.trim();
  return normalizedTitle || text;
}

function formatActionStatusLabel(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return "미지정";
  if (normalized === "todo") return "할 일";
  if (normalized === "in_progress") return "진행 중";
  if (normalized === "done") return "완료";
  if (normalized === "blocked") return "보류";
  return status ?? "미지정";
}

function formatActionPriorityLabel(priority: string | null | undefined) {
  const normalized = priority?.trim().toLowerCase();
  if (!normalized) return "미지정";
  if (normalized === "high") return "높음";
  if (normalized === "medium") return "보통";
  if (normalized === "low") return "낮음";
  return priority ?? "미지정";
}

type SpeakerDraftMap = Record<string, string>;

export function MeetingLiveView({ pageId, variant = "inline", hideWhenDisabled = false }: Props) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const [storeAudio, setStoreAudio] = useState(false);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>("single_recorder");
  const [participantLabel, setParticipantLabel] = useState("");
  const [activeTab, setActiveTab] = useState<"transcript" | "notes">("transcript");
  const [speakerDrafts, setSpeakerDrafts] = useState<SpeakerDraftMap>({});
  const [postStopChoiceSessionId, setPostStopChoiceSessionId] = useState<string | null>(null);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState("");
  const [focusedUtteranceId, setFocusedUtteranceId] = useState<string | null>(null);
  const [playingUtteranceId, setPlayingUtteranceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentUser = trpc.user.me.useQuery(undefined, { refetchOnWindowFocus: false }).data;
  const recorderStatus = useMeetingRecorderStore((s) => s.status);
  const recorderSessionId = useMeetingRecorderStore((s) => s.sessionId);
  const recorderParticipantLabel = useMeetingRecorderStore((s) => s.participantLabel);
  const elapsedMs = useMeetingRecorderStore((s) => s.elapsedMs);
  const startRecording = useMeetingRecorderStore((s) => s.startRecording);
  const stopRecording = useMeetingRecorderStore((s) => s.stopRecording);
  const resetRecorderSession = useMeetingRecorderStore((s) => s.resetSession);

  const pageStateQuery = trpc.meeting.getPageState.useQuery(
    { pageId },
    {
      refetchOnWindowFocus: false,
      refetchInterval: (query) => (query.state.data?.session?.status === "active" ? 2500 : false),
      refetchIntervalInBackground: true,
    },
  );
  const { data, isLoading } = pageStateQuery;
  const targetsQuery = trpc.meeting.getWorkspaceTargets.useQuery(
    { pageId },
    {
      enabled: !!data?.page?.canEdit && !!data?.page?.meetingEnabled,
      refetchOnWindowFocus: false,
    },
  );
  const page = data?.page;
  const session = data?.session;

  useEffect(() => {
    const currentSpeakers = data?.session?.speakers ?? [];
    setSpeakerDrafts((previous) => {
      const next = { ...previous };
      currentSpeakers.forEach((speaker: MeetingSpeaker) => {
        if (!next[speaker.id]) {
          next[speaker.id] = speaker.displayName ?? speaker.resolvedName;
        }
      });
      return next;
    });
  }, [data?.session?.speakers]);

  useEffect(() => {
    if (!participantLabel.trim() && currentUser?.name) {
      setParticipantLabel(currentUser.name);
    }
  }, [currentUser?.name, participantLabel]);

  useEffect(() => {
    if (data?.session?.status === "active" && data.session.mode) {
      setMeetingMode(data.session.mode as MeetingMode);
    }
  }, [data?.session?.mode, data?.session?.status]);

  useEffect(() => {
    const unlockedDatabases = (targetsQuery.data?.databases ?? []).filter((database) => !database.isLocked);

    setSelectedDatabaseId((previous) => {
      if (previous && unlockedDatabases.some((database) => database.id === previous)) {
        return previous;
      }
      return unlockedDatabases[0]?.id ?? "";
    });
  }, [targetsQuery.data?.databases]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/meeting/stream?pageId=${pageId}`);
    eventSource.onmessage = () => {
      void utils.meeting.getPageState.invalidate({ pageId });
    };
    eventSource.onerror = () => {
      void utils.meeting.getPageState.invalidate({ pageId });
    };
    return () => eventSource.close();
  }, [pageId, utils.meeting.getPageState]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleMeetingEnabled = trpc.meeting.togglePageEnabled.useMutation({
    onSuccess: () => {
      void utils.meeting.getPageState.invalidate({ pageId });
      void utils.page.get.invalidate({ id: pageId });
    },
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const startSession = trpc.meeting.startSession.useMutation({
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const stopSession = trpc.meeting.stopSession.useMutation({
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const renameSpeaker = trpc.meeting.renameSpeaker.useMutation({
    onSuccess: () => {
      void utils.meeting.getPageState.invalidate({ pageId });
    },
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const exportSession = trpc.meeting.exportSessionToPage.useMutation({
    onSuccess: (result) => {
      addToast({ type: "success", message: `${result.createdBlockCount}개 블록이 문서 상단에 반영되었습니다` });
      void utils.block.list.invalidate({ pageId });
      void utils.page.get.invalidate({ id: pageId });
      setPostStopChoiceSessionId(null);
      router.refresh();
    },
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const joinSessionAudio = trpc.meeting.joinSessionAudio.useMutation({
    onSuccess: () => {
      void utils.meeting.getPageState.invalidate({ pageId });
    },
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const leaveSessionAudio = trpc.meeting.leaveSessionAudio.useMutation({
    onSuccess: () => {
      void utils.meeting.getPageState.invalidate({ pageId });
    },
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const heartbeatSessionAudio = trpc.meeting.heartbeatSessionAudio.useMutation();

  const promoteActionItem = trpc.meeting.promoteActionItem.useMutation({
    onSuccess: (result) => {
      addToast({
        type: "success",
        message: result.targetType === "database_row"
          ? "액션 아이템을 데이터베이스 row로 만들었습니다"
          : "액션 아이템을 워크스페이스 항목으로 만들었습니다",
      });
    },
    onError: (error) => {
      addToast({ type: "error", message: error.message });
    },
  });

  const canEdit = page?.canEdit ?? false;
  const isActiveSession = session?.status === "active";
  const currentMode = ((isActiveSession ? session?.mode : null) ?? meetingMode) as MeetingMode;
  const participantDraft = participantLabel.trim() || currentUser?.name?.trim() || "참가자";
  const isRecorderBoundToSession = !!session?.id && recorderSessionId === session.id;
  const isRecording = isRecorderBoundToSession && (recorderStatus === "recording" || recorderStatus === "stopping");
  const isMultiParticipantSession = session?.mode === "multi_participant";
  const participants = useMemo(
    () => session?.participants ?? [],
    [session?.participants],
  );
  const activeParticipants = useMemo(
    () => participants.filter((participant: MeetingParticipant) => participant.status === "active"),
    [participants],
  );
  const isCurrentUserParticipant = activeParticipants.some(
    (participant: MeetingParticipant) => participant.userId === currentUser?.id,
  );
  const transcript = useMemo(
    () => session?.utterances ?? [],
    [session?.utterances],
  );
  const snapshot = session?.snapshot;
  const unlockedDatabases = useMemo(
    () => (targetsQuery.data?.databases ?? []).filter((database) => !database.isLocked),
    [targetsQuery.data?.databases],
  );
  const hasPromotionTargets = unlockedDatabases.length > 0;
  const transcriptById = useMemo(
    () => new Map(transcript.map((utterance) => [utterance.id, utterance])),
    [transcript],
  );
  const speakerNameById = useMemo(
    () => new Map((session?.speakers ?? []).map((speaker) => [speaker.id, speaker.resolvedName])),
    [session?.speakers],
  );
  const transcriptGroups = useMemo(() => {
    const groups: Array<{
      anchorId: string;
      utteranceIds: string[];
      speakerId: string | null;
      speakerLabel: string;
      resolvedName: string;
      text: string;
      startMs: number;
      endMs: number;
      audioUtterance: MeetingUtterance;
    }> = [];

    transcript.forEach((utterance) => {
      const resolvedName = utterance.speakerId
        ? speakerNameById.get(utterance.speakerId) ?? utterance.speakerLabel
        : utterance.speakerLabel;
      const previous = groups[groups.length - 1];
      const gapMs = previous ? Math.max(0, utterance.startMs - previous.endMs) : Number.POSITIVE_INFINITY;
      const shouldMerge =
        !!previous
        && previous.speakerId === utterance.speakerId
        && previous.speakerLabel === utterance.speakerLabel
        && gapMs <= 5000
        && previous.text.length + utterance.text.length <= 520
        && (
          previous.utteranceIds.length < 4
          || !/[.!?。！？]$/.test(previous.text.trim())
          || gapMs <= 1200
        );

      if (!shouldMerge || !previous) {
        groups.push({
          anchorId: utterance.id,
          utteranceIds: [utterance.id],
          speakerId: utterance.speakerId,
          speakerLabel: utterance.speakerLabel,
          resolvedName,
          text: utterance.text,
          startMs: utterance.startMs,
          endMs: utterance.endMs,
          audioUtterance: utterance,
        });
        return;
      }

      previous.utteranceIds.push(utterance.id);
      previous.text = joinTranscriptText(previous.text, utterance.text, gapMs);
      previous.endMs = utterance.endMs;
    });

    return groups;
  }, [speakerNameById, transcript]);
  const utteranceAnchorIdByUtteranceId = useMemo(() => {
    const mapping = new Map<string, string>();
    transcriptGroups.forEach((group) => {
      group.utteranceIds.forEach((utteranceId) => {
        mapping.set(utteranceId, group.anchorId);
      });
    });
    return mapping;
  }, [transcriptGroups]);
  const showPostStopChoice = !!(
    postStopChoiceSessionId
    && session?.id === postStopChoiceSessionId
    && session?.status === "completed"
    && session?.snapshot
  );

  const transcriptCountLabel = useMemo(
    () => `${transcriptGroups.length}개 묶음`,
    [transcriptGroups.length],
  );

  useEffect(() => {
    if (!session?.id || session.mode !== "multi_participant" || !isRecording) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void heartbeatSessionAudio.mutateAsync({
        sessionId: session.id,
        displayName: participantDraft,
      }).catch(() => undefined);
    }, 10_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [heartbeatSessionAudio, isRecording, participantDraft, session?.id, session?.mode]);

  useEffect(() => {
    const shouldStop =
      recorderSessionId
      && recorderSessionId === session?.id
      && session?.status !== "active"
      && (recorderStatus === "recording" || recorderStatus === "stopping");

    if (!shouldStop) return;

    void stopRecording()
      .catch(() => undefined)
      .finally(() => {
        resetRecorderSession();
      });
  }, [recorderSessionId, recorderStatus, resetRecorderSession, session?.id, session?.status, stopRecording]);

  if (!isLoading && hideWhenDisabled && !page?.meetingEnabled && !session) {
    return null;
  }

  const handleEnable = async (enabled: boolean) => {
    await toggleMeetingEnabled.mutateAsync({ pageId, enabled });
  };

  const resolveSpeakerName = (utterance: MeetingUtterance) => {
    if (utterance.speakerId && speakerNameById.has(utterance.speakerId)) {
      return speakerNameById.get(utterance.speakerId) ?? utterance.speakerLabel;
    }
    return utterance.speakerLabel;
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingUtteranceId(null);
  };

  const focusUtterance = (utteranceId: string, switchToTranscript = false) => {
    setFocusedUtteranceId(utteranceId);
    if (switchToTranscript) {
      setActiveTab("transcript");
    }

    const anchorId = utteranceAnchorIdByUtteranceId.get(utteranceId) ?? utteranceId;

    window.setTimeout(() => {
      document.getElementById(`meeting-utterance-${anchorId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, switchToTranscript ? 60 : 0);
  };

  const handlePlayUtterance = async (utterance: MeetingUtterance, options?: { switchToTranscript?: boolean }) => {
    focusUtterance(utterance.id, options?.switchToTranscript ?? false);

    if (!session?.audioAvailable) {
      return;
    }

    if (playingUtteranceId === utterance.id) {
      stopAudioPlayback();
      return;
    }

    stopAudioPlayback();

    const params = new URLSearchParams({
      sessionId: session.id,
      chunkIndex: String(utterance.chunkIndex),
    });
    if (session.mode === "multi_participant") {
      params.set("sourceKey", utterance.audioSourceKey);
    }

    const audio = new Audio(`/api/meeting/audio/chunk?${params.toString()}`);
    audio.preload = "auto";
    audioRef.current = audio;
    setPlayingUtteranceId(utterance.id);

    const offsetSeconds = Math.max(0, utterance.startMs - utterance.chunkStartedAtMs) / 1000;

    const cleanupIfCurrent = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingUtteranceId((current) => (current === utterance.id ? null : current));
    };

    audio.addEventListener("loadedmetadata", () => {
      const safeOffset = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(offsetSeconds, Math.max(audio.duration - 0.05, 0))
        : offsetSeconds;

      audio.currentTime = safeOffset;
      void audio.play().catch(() => {
        cleanupIfCurrent();
        addToast({ type: "error", message: "오디오 재생을 시작하지 못했습니다" });
      });
    }, { once: true });

    audio.addEventListener("ended", cleanupIfCurrent, { once: true });
    audio.addEventListener("error", () => {
      cleanupIfCurrent();
      addToast({ type: "error", message: "저장된 오디오 청크를 찾을 수 없습니다" });
    }, { once: true });
  };

  const handlePromoteActionItem = async (actionItemIndex: number) => {
    if (!session?.id) return;
    if (!selectedDatabaseId) {
      addToast({
        type: "error",
        message: "먼저 데이터베이스를 선택해주세요",
      });
      return;
    }

    await promoteActionItem.mutateAsync({
      sessionId: session.id,
      actionItemIndex,
      targetType: "database_row",
      targetId: selectedDatabaseId,
    });
  };

  const renderEvidenceButtons = (evidenceUtteranceIds: string[]) => {
    const evidenceUtterances = evidenceUtteranceIds
      .map((utteranceId) => transcriptById.get(utteranceId))
      .filter((utterance): utterance is MeetingUtterance => !!utterance);

    if (evidenceUtterances.length === 0) {
      return null;
    }

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {evidenceUtterances.map((utterance) => (
          <button
            key={utterance.id}
            onClick={() => void handlePlayUtterance(utterance, { switchToTranscript: true })}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
            style={{
              backgroundColor: "rgba(35, 131, 226, 0.12)",
              color: "#2383e2",
            }}
          >
            <ArrowUpRight size={11} />
            {resolveSpeakerName(utterance)} · {formatUtteranceTime(utterance.startMs)}
          </button>
        ))}
      </div>
    );
  };

  const buildRecorderParams = (targetSession: NonNullable<typeof session>) => {
    const startedAt = targetSession.startedAt ? new Date(targetSession.startedAt).getTime() : Date.now();
    const initialChunkStartedAtMs = Math.max(0, Date.now() - startedAt);

    return {
      pageId,
      sessionId: targetSession.id,
      participantLabel: targetSession.mode === "multi_participant" ? participantDraft : null,
      initialChunkIndex: targetSession.mode === "single_recorder"
        ? Math.max((targetSession.lastChunkIndex ?? -1) + 1, 0)
        : Math.max(Math.floor(initialChunkStartedAtMs / 5000), 0),
      initialChunkStartedAtMs,
    };
  };

  const handleStart = async () => {
    try {
      const result = await startSession.mutateAsync({
        pageId,
        storeAudio,
        mode: currentMode,
      });

      const startedSession = result.session;
      const sessionId = startedSession?.id;
      if (!startedSession || !sessionId) {
        throw new Error("세션 시작에 실패했습니다");
      }

      try {
        if (startedSession.mode === "multi_participant") {
          await joinSessionAudio.mutateAsync({
            sessionId,
            displayName: participantDraft,
          });
        }
        await startRecording(buildRecorderParams(startedSession));
      } catch (error) {
        if (startedSession.mode === "multi_participant") {
          await leaveSessionAudio.mutateAsync({ sessionId }).catch(() => undefined);
        }
        if (!result.reusedExisting) {
          await stopSession.mutateAsync({ sessionId }).catch(() => undefined);
        }
        resetRecorderSession();
        throw error;
      }

      addToast({
        type: "success",
        message: currentMode === "multi_participant"
          ? "참여자별 마이크 회의를 시작했습니다"
          : "회의 녹음을 시작했습니다",
      });
      void utils.meeting.getPageState.invalidate({ pageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "회의 시작에 실패했습니다";
      addToast({ type: "error", message });
    }
  };

  const handleStartLocalRecorder = async () => {
    if (!session) return;

    try {
      if (session.mode === "multi_participant") {
        await joinSessionAudio.mutateAsync({
          sessionId: session.id,
          displayName: participantDraft,
        });
      }
      await startRecording(buildRecorderParams(session));
      addToast({
        type: "success",
        message: session.mode === "multi_participant"
          ? `${participantDraft} 이름으로 마이크 참여를 시작했습니다`
          : "마이크를 다시 연결했습니다",
      });
    } catch (error) {
      if (session.mode === "multi_participant") {
        await leaveSessionAudio.mutateAsync({ sessionId: session.id }).catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : "마이크 연결에 실패했습니다";
      addToast({ type: "error", message });
    }
  };

  const handleStopLocalRecorder = async () => {
    try {
      await stopRecording();
      if (session?.mode === "multi_participant" && session.id) {
        await leaveSessionAudio.mutateAsync({ sessionId: session.id });
      }
      resetRecorderSession();
      addToast({ type: "success", message: "내 마이크를 종료했습니다" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "마이크 종료에 실패했습니다";
      addToast({ type: "error", message });
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      if (typeof window === "undefined") return;
      await navigator.clipboard.writeText(window.location.href);
      addToast({ type: "success", message: "회의 페이지 링크를 복사했습니다" });
    } catch {
      addToast({ type: "error", message: "링크 복사에 실패했습니다" });
    }
  };

  const handleStop = async () => {
    const targetSessionId = session?.id ?? recorderSessionId;
    if (!targetSessionId) return;

    try {
      if (isRecorderBoundToSession || recorderStatus === "recording" || recorderStatus === "stopping") {
        await stopRecording();
      }
      await stopSession.mutateAsync({ sessionId: targetSessionId });
      resetRecorderSession();
      setPostStopChoiceSessionId(targetSessionId);
      addToast({ type: "success", message: "회의를 종료했습니다" });
      void utils.meeting.getPageState.invalidate({ pageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "회의 종료에 실패했습니다";
      addToast({ type: "error", message });
    }
  };

  const wrapperClassName = variant === "panel"
    ? "flex h-full min-h-0 flex-col"
    : "flex max-h-[780px] min-h-0 flex-col overflow-hidden rounded-xl border";

  const wrapperStyle = variant === "panel"
    ? {
        backgroundColor: "var(--bg-primary)",
      }
    : {
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-default)",
      };

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(35, 131, 226, 0.12)", color: "#2383e2" }}
            >
              <Mic size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                라이브 회의
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-tertiary)" }}>
                {page?.meetingEnabled ? "이 페이지에서 회의 기능이 활성화됨" : "이 페이지에서 회의 기능이 꺼져 있음"}
              </p>
              <p className="truncate text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {canEdit ? "편집 권한으로 회의 제어 가능" : "읽기 전용으로 회의 상태만 확인 가능"}
              </p>
            </div>
          </div>
        </div>

        {page?.meetingEnabled ? (
          <button
            onClick={() => void handleEnable(false)}
            disabled={!canEdit || toggleMeetingEnabled.isPending}
            className="rounded-md px-2.5 py-1 text-xs"
            style={{
              backgroundColor: !canEdit ? "var(--bg-tertiary)" : "var(--bg-primary)",
              color: !canEdit ? "var(--text-tertiary)" : "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            기능 끄기
          </button>
        ) : (
          <button
            onClick={() => void handleEnable(true)}
            disabled={!canEdit || toggleMeetingEnabled.isPending}
            className="rounded-md px-2.5 py-1 text-xs"
            style={{
              backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#2383e2",
              color: !canEdit ? "var(--text-tertiary)" : "white",
            }}
          >
            기능 켜기
          </button>
        )}
      </div>

      {!page?.meetingEnabled ? (
        <div className="px-4 py-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {canEdit
            ? "이 페이지에 회의 기능을 켜면 실시간 대본과 자동 회의록이 함께 표시됩니다."
            : "이 페이지는 아직 회의 기능이 꺼져 있고, 현재 권한으로는 기능을 켤 수 없습니다."}
        </div>
      ) : (
        <div className={variant === "panel" ? "flex-1 min-h-0 overflow-y-auto" : "max-h-[720px] overflow-y-auto"}>
          {!canEdit && (
            <div
              className="flex items-start gap-2 border-b px-4 py-3 text-sm"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              <Lock size={14} className="mt-0.5 flex-shrink-0" />
              <p>현재는 읽기 전용 상태입니다. 회의 대본과 회의록은 볼 수 있지만, 시작/종료나 이름 수정은 할 수 없습니다.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMeetingMode("single_recorder")}
                disabled={isActiveSession || !canEdit}
                className="rounded-md px-2 py-1 text-xs"
                style={{
                  backgroundColor: currentMode === "single_recorder" ? "rgba(35, 131, 226, 0.12)" : "var(--bg-primary)",
                  color: currentMode === "single_recorder" ? "#2383e2" : "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                룸 마이크
              </button>
              <button
                onClick={() => setMeetingMode("multi_participant")}
                disabled={isActiveSession || !canEdit}
                className="rounded-md px-2 py-1 text-xs"
                style={{
                  backgroundColor: currentMode === "multi_participant" ? "rgba(35, 131, 226, 0.12)" : "var(--bg-primary)",
                  color: currentMode === "multi_participant" ? "#2383e2" : "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                참여자별 마이크
              </button>
            </div>

            {currentMode === "multi_participant" && (
              <input
                value={participantLabel}
                onChange={(event) => setParticipantLabel(event.target.value)}
                disabled={isRecording || !canEdit}
                placeholder="내 표시 이름"
                className="w-40 rounded-md border px-2 py-1 text-xs"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
            )}

            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={storeAudio}
                onChange={(event) => setStoreAudio(event.target.checked)}
                disabled={!canEdit}
              />
              원본 오디오 저장
            </label>

            <div
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              style={{
                backgroundColor: isActiveSession ? "rgba(235, 87, 87, 0.12)" : "var(--bg-primary)",
                color: isActiveSession ? "#eb5757" : "var(--text-tertiary)",
              }}
            >
              {isActiveSession ? <Radio size={12} /> : <MicOff size={12} />}
              {isActiveSession ? "세션 활성" : "세션 없음"}
            </div>

            <div
              className="rounded-full px-2 py-1 text-xs"
              style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-tertiary)" }}
            >
              {currentMode === "multi_participant" ? "참여자별 마이크" : "룸 마이크"}
            </div>

            {isMultiParticipantSession && recorderParticipantLabel && (
              <div
                className="rounded-full px-2 py-1 text-xs"
                style={{ backgroundColor: "rgba(35, 131, 226, 0.12)", color: "#2383e2" }}
              >
                내 이름 {recorderParticipantLabel}
              </div>
            )}

            {isRecording && (
              <div
                className="rounded-full px-2 py-1 text-xs"
                style={{ backgroundColor: "rgba(35, 131, 226, 0.12)", color: "#2383e2" }}
              >
                녹음 중 {formatElapsed(elapsedMs)}
              </div>
            )}

            {session?.lastNotesGeneratedAt && (
              <div
                className="rounded-full px-2 py-1 text-xs"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-tertiary)" }}
              >
                회의록 갱신 {formatDateTime(session.lastNotesGeneratedAt)}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {!isActiveSession ? (
                <button
                  onClick={() => void handleStart()}
                  disabled={!canEdit || startSession.isPending || isLoading}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#2383e2",
                    color: !canEdit ? "var(--text-tertiary)" : "white",
                  }}
                >
                  {startSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                  회의 시작
                </button>
              ) : isMultiParticipantSession ? (
                <>
                  {isRecording ? (
                    <button
                      onClick={() => void handleStopLocalRecorder()}
                      disabled={!canEdit || recorderStatus === "stopping"}
                      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <MicOff size={14} />
                      내 마이크 끄기
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleStartLocalRecorder()}
                      disabled={!canEdit}
                      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#2383e2",
                        color: !canEdit ? "var(--text-tertiary)" : "white",
                      }}
                    >
                      <Mic size={14} />
                      마이크 참여
                    </button>
                  )}

                  <button
                    onClick={() => void handleStop()}
                    disabled={!canEdit || stopSession.isPending}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                    style={{
                      backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#eb5757",
                      color: !canEdit ? "var(--text-tertiary)" : "white",
                    }}
                  >
                    {stopSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <MicOff size={14} />}
                    회의 종료
                  </button>
                </>
              ) : isRecording ? (
                <button
                  onClick={() => void handleStop()}
                  disabled={!canEdit || stopSession.isPending}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#eb5757",
                    color: !canEdit ? "var(--text-tertiary)" : "white",
                  }}
                >
                  {stopSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <MicOff size={14} />}
                  회의 종료
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void handleStartLocalRecorder()}
                    disabled={!canEdit}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                    style={{
                      backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#2383e2",
                      color: !canEdit ? "var(--text-tertiary)" : "white",
                    }}
                  >
                    <Mic size={14} />
                    녹음 다시 연결
                  </button>
                  <button
                    onClick={() => void handleStop()}
                    disabled={!canEdit || stopSession.isPending}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                    style={{
                      backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#eb5757",
                      color: !canEdit ? "var(--text-tertiary)" : "white",
                    }}
                  >
                    {stopSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <MicOff size={14} />}
                    회의 종료
                  </button>
                </>
              )}

              {session?.snapshot && (
                <button
                  onClick={() => exportSession.mutate({ sessionId: session.id })}
                  disabled={!canEdit || exportSession.isPending}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    color: !canEdit ? "var(--text-tertiary)" : "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {exportSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  문서 반영
                </button>
              )}
            </div>
          </div>

          {session?.lastError && (
            <div
              className="flex items-start gap-2 border-b px-4 py-3 text-sm"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "rgba(235, 87, 87, 0.06)",
                color: "#b42318",
              }}
            >
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <p>{session.lastError}</p>
                {session.lastErrorAt && (
                  <p className="mt-1 text-xs" style={{ color: "#b42318" }}>
                    최근 오류 시각: {formatDateTime(session.lastErrorAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {showPostStopChoice && (
            <div
              className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm"
              style={{ borderColor: "var(--border-default)", backgroundColor: "rgba(35, 131, 226, 0.06)" }}
            >
              <p style={{ color: "var(--text-primary)" }}>
                회의가 종료되었습니다. 이 결과를 라이브 블록으로만 유지할지, 지금 문서 본문에 반영할지 선택하세요.
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setPostStopChoiceSessionId(null)}
                  className="rounded-md px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  라이브로 유지
                </button>
                <button
                  onClick={() => session?.id && exportSession.mutate({ sessionId: session.id })}
                  disabled={!canEdit || exportSession.isPending}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: !canEdit ? "var(--bg-tertiary)" : "#2383e2",
                    color: !canEdit ? "var(--text-tertiary)" : "white",
                  }}
                >
                  {exportSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  문서로 반영
                </button>
              </div>
            </div>
          )}

          {(currentMode === "multi_participant" || participants.length > 0) && (
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Users size={14} style={{ color: "#2383e2" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    참여자
                  </p>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    현재 {activeParticipants.length}명 참여 중
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => void handleCopyInviteLink()}
                    className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <Copy size={12} />
                    초대 링크 복사
                  </button>
                </div>
              </div>

              {participants.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {participants.map((participant: MeetingParticipant) => {
                    const isMe = participant.userId === currentUser?.id;
                    const isActive = participant.status === "active";

                    return (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                        style={{
                          borderColor: "var(--border-default)",
                          backgroundColor: "var(--bg-primary)",
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {participant.displayName}
                            {isMe ? " (나)" : ""}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {isActive
                              ? `최근 감지 ${formatDateTime(participant.lastSeenAt)}`
                              : `마지막 참여 ${formatDateTime(participant.leftAt ?? participant.lastSeenAt) || "기록 없음"}`}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-2 py-1 text-[11px]"
                          style={{
                            backgroundColor: isActive ? "rgba(35, 131, 226, 0.12)" : "var(--bg-secondary)",
                            color: isActive ? "#2383e2" : "var(--text-tertiary)",
                          }}
                        >
                          {isActive ? "참여 중" : "마이크 종료"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  아직 참여자가 없습니다. 페이지 링크를 공유하고 각 참여자가 마이크 참여를 누르면 목록에 나타납니다.
                </p>
              )}

              {isMultiParticipantSession && !isCurrentUserParticipant && canEdit && (
                <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  이 세션은 참여자별 마이크 모드입니다. 내 마이크 참여를 누르면 내 이름으로 화자가 고정됩니다.
                </p>
              )}
            </div>
          )}

          {!isActiveSession && (
            <div
              className="border-b px-4 py-3 text-sm"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              {session?.snapshot
                ? "최근 회의 결과를 그대로 보관 중입니다. 필요하면 문서로 반영하거나 새 회의를 시작할 수 있습니다."
                : "회의를 시작하면 5초 단위로 대본이 들어오고, 요약·결정 사항·액션 아이템이 자동으로 정리됩니다."}
            </div>
          )}

          <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border-default)" }}>
            <button
              onClick={() => setActiveTab("transcript")}
              className="rounded-md px-2 py-1 text-sm"
              style={{
                backgroundColor: activeTab === "transcript" ? "var(--bg-primary)" : "transparent",
                color: activeTab === "transcript" ? "var(--text-primary)" : "var(--text-tertiary)",
              }}
            >
              실시간 대본
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className="rounded-md px-2 py-1 text-sm"
              style={{
                backgroundColor: activeTab === "notes" ? "var(--bg-primary)" : "transparent",
                color: activeTab === "notes" ? "var(--text-primary)" : "var(--text-tertiary)",
              }}
            >
              자동 회의록
            </button>
            <div className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>
              {transcriptCountLabel}
            </div>
          </div>

          <div className="px-4 py-4">
            {activeTab === "transcript" ? (
              <div className="space-y-2">
                {transcriptGroups.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
                    아직 전사된 발화가 없습니다.
                  </div>
                ) : (
                  transcriptGroups.map((group) => {
                    const isFocused = !!focusedUtteranceId && group.utteranceIds.includes(focusedUtteranceId);
                    const isPlaying = playingUtteranceId === group.audioUtterance.id;
                    return (
                      <div
                        id={`meeting-utterance-${group.anchorId}`}
                        key={group.anchorId}
                        className="rounded-lg border px-2.5 py-2"
                        style={{
                          borderColor: isFocused ? "#2383e2" : "var(--border-default)",
                          backgroundColor: isFocused ? "rgba(35, 131, 226, 0.06)" : "var(--bg-primary)",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[11px] font-semibold" style={{ color: "#2383e2" }}>
                              {group.resolvedName}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                              {formatUtteranceTime(group.startMs)}
                            </span>
                            {group.utteranceIds.length > 1 && (
                              <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>
                                +{group.utteranceIds.length - 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {session?.audioAvailable && (
                              <button
                                onClick={() => void handlePlayUtterance(group.audioUtterance)}
                                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                                style={{
                                  backgroundColor: "var(--bg-secondary)",
                                  color: isPlaying ? "#2383e2" : "var(--text-secondary)",
                                }}
                              >
                                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                {isPlaying ? "정지" : "듣기"}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[13px] leading-5" style={{ color: "var(--text-primary)" }}>
                          {group.text}
                        </p>
                      </div>
                    );
                  })
                )}

                {session?.speakers && session.speakers.length > 0 && (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                    <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      화자 이름 보정
                    </p>
                    <div className="space-y-2">
                      {session.speakers.map((speaker: MeetingSpeaker) => (
                        <div key={speaker.id} className="flex items-center gap-2">
                          <input
                            value={speakerDrafts[speaker.id] ?? ""}
                            onChange={(event) =>
                              setSpeakerDrafts((previous) => ({
                                ...previous,
                                [speaker.id]: event.target.value,
                              }))
                            }
                            disabled={!canEdit}
                            className="flex-1 rounded-md border px-2 py-1 text-sm"
                            style={{
                              borderColor: "var(--border-default)",
                              backgroundColor: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                            }}
                          />
                          <button
                            onClick={() =>
                              renameSpeaker.mutate({
                                speakerId: speaker.id,
                                displayName: speakerDrafts[speaker.id] ?? speaker.resolvedName,
                              })
                            }
                            disabled={!canEdit || renameSpeaker.isPending}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                            style={{
                              backgroundColor: "var(--bg-secondary)",
                              color: !canEdit ? "var(--text-tertiary)" : "var(--text-primary)",
                            }}
                          >
                            <Save size={12} />
                            저장
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {snapshot ? (
                  <>
                    {canEdit && (
                      <section className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                        <div className="mb-3 flex items-center gap-2">
                          <ArrowUpRight size={14} style={{ color: "#2383e2" }} />
                          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            액션 아이템 승격
                          </h3>
                        </div>
                        {hasPromotionTargets ? (
                          <div className="grid gap-3">
                            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              워크스페이스 DB로 보낼 데이터베이스
                              <select
                                value={selectedDatabaseId}
                                onChange={(event) => setSelectedDatabaseId(event.target.value)}
                                className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                style={{
                                  borderColor: "var(--border-default)",
                                  backgroundColor: "var(--bg-secondary)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="">선택 안 함</option>
                                {unlockedDatabases.map((database) => (
                                  <option key={database.id} value={database.id}>
                                    {database.icon ? `${database.icon} ` : ""}{database.title || "제목 없는 DB"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            이 워크스페이스에서 바로 연결할 데이터베이스가 없습니다.
                          </p>
                        )}
                      </section>
                    )}

                    <section className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                      <div className="mb-2 flex items-center gap-2">
                        <FileText size={14} style={{ color: "#2383e2" }} />
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          요약
                        </h3>
                      </div>
                      <p className="text-sm leading-6" style={{ color: "var(--text-primary)", whiteSpace: "pre-line" }}>
                        {snapshot.summary || "아직 생성된 요약이 없습니다."}
                      </p>
                    </section>

                    <section className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                      <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        논의 사항
                      </h3>
                      <div className="space-y-2 text-sm" style={{ color: "var(--text-primary)" }}>
                        {snapshot.discussionItems.length > 0 ? (
                          snapshot.discussionItems.map((item, index) => (
                            <div key={`${item.text}-${index}`} className="rounded-md border px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                {formatEvidenceHeading(item.title, item.text)}
                              </p>
                              <p className="mt-2 leading-6" style={{ color: "var(--text-primary)", whiteSpace: "pre-line" }}>
                                {item.text}
                              </p>
                              {item.detail && (
                                <p className="mt-2 text-xs leading-6" style={{ color: "var(--text-secondary)", whiteSpace: "pre-line" }}>
                                  {item.detail}
                                </p>
                              )}
                              {renderEvidenceButtons(item.evidenceUtteranceIds)}
                            </div>
                          ))
                        ) : (
                          <p style={{ color: "var(--text-tertiary)" }}>아직 정리된 논의가 없습니다.</p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                      <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        결정 사항
                      </h3>
                      <div className="space-y-2 text-sm" style={{ color: "var(--text-primary)" }}>
                        {snapshot.decisionItems.length > 0 ? (
                          snapshot.decisionItems.map((item, index) => (
                            <div key={`${item.text}-${index}`} className="rounded-md border px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                {formatEvidenceHeading(item.title, item.text)}
                              </p>
                              <p className="mt-2 leading-6" style={{ color: "var(--text-primary)", whiteSpace: "pre-line" }}>
                                {item.text}
                              </p>
                              {item.detail && (
                                <p className="mt-2 text-xs leading-6" style={{ color: "var(--text-secondary)", whiteSpace: "pre-line" }}>
                                  {item.detail}
                                </p>
                              )}
                              {renderEvidenceButtons(item.evidenceUtteranceIds)}
                            </div>
                          ))
                        ) : (
                          <p style={{ color: "var(--text-tertiary)" }}>아직 정리된 결정이 없습니다.</p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
                      <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        액션 아이템
                      </h3>
                      <div className="space-y-2 text-sm" style={{ color: "var(--text-primary)" }}>
                        {snapshot.actionItems.length > 0 ? (
                          snapshot.actionItems.map((item, index) => (
                            <div key={`${item.text}-${index}`} className="rounded-md border px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
                              <p className="leading-6" style={{ color: "var(--text-primary)", whiteSpace: "pre-line" }}>{item.text}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-full px-2 py-1" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                                  {item.owner ? `담당 ${item.owner}` : "담당 미지정"}
                                </span>
                                <span className="rounded-full px-2 py-1" style={{ backgroundColor: "rgba(35, 131, 226, 0.12)", color: "#2383e2" }}>
                                  상태 {formatActionStatusLabel(item.status)}
                                </span>
                                <span className="rounded-full px-2 py-1" style={{ backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#b45309" }}>
                                  우선순위 {formatActionPriorityLabel(item.priority)}
                                </span>
                                <span className="rounded-full px-2 py-1" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                                  기한 {item.dueDate?.trim() || "-"}
                                </span>
                              </div>
                              {renderEvidenceButtons(item.evidenceUtteranceIds)}
                              {canEdit && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void handlePromoteActionItem(index)}
                                    disabled={!selectedDatabaseId || promoteActionItem.isPending}
                                    className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs"
                                    style={{
                                      backgroundColor: selectedDatabaseId ? "rgba(14, 116, 144, 0.12)" : "var(--bg-secondary)",
                                      color: selectedDatabaseId ? "#0e7490" : "var(--text-tertiary)",
                                    }}
                                  >
                                    <Database size={12} />
                                    DB row로 만들기
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p style={{ color: "var(--text-tertiary)" }}>아직 생성된 액션 아이템이 없습니다.</p>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
                    회의록 스냅샷이 아직 생성되지 않았습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

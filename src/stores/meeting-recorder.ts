import { create } from "zustand";
import { useToastStore } from "@/stores/toast";

type RecorderStatus = "idle" | "requesting_permission" | "recording" | "stopping" | "error";

type QueueItem = {
  blob: Blob;
  mimeType: string | null;
  chunkIndex: number;
  chunkStartedAtMs: number;
  chunkEndedAtMs: number;
};

type MeetingRecorderStore = {
  status: RecorderStatus;
  pageId: string | null;
  sessionId: string | null;
  participantLabel: string | null;
  error: string | null;
  elapsedMs: number;
  queueLength: number;
  isUploading: boolean;
  startRecording: (params: {
    pageId: string;
    sessionId: string;
    participantLabel?: string | null;
    initialChunkIndex?: number;
    initialChunkStartedAtMs?: number;
  }) => Promise<void>;
  stopRecording: () => Promise<void>;
  resetSession: () => void;
};

const MIN_CHUNK_DURATION_MS = 5000;
const MAX_CHUNK_DURATION_MS = 12000;
const SILENCE_HOLD_MS = 900;
const VAD_POLL_INTERVAL_MS = 200;
const MIN_VAD_RMS_THRESHOLD = 0.012;
const NOISE_FLOOR_MULTIPLIER = 3.2;
const NOISE_FLOOR_SMOOTHING = 0.18;
const NOISE_CALIBRATION_MS = 1200;
const NOISE_CALIBRATION_INTERVAL_MS = 120;
const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
] as const;

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let segmentTimer: ReturnType<typeof setTimeout> | null = null;
let vadTimer: ReturnType<typeof setInterval> | null = null;
let uploadQueue: QueueItem[] = [];
let isUploading = false;
let recordingStartedAt = 0;
let nextChunkIndex = 0;
let nextChunkStartedAtMs = 0;
let preferredMimeType: string | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let mediaSourceNode: MediaStreamAudioSourceNode | null = null;
let noiseFloorRms = 0.006;
let adaptiveVadThreshold = MIN_VAD_RMS_THRESHOLD;

function setStoreState(partial: Partial<Omit<MeetingRecorderStore, "startRecording" | "stopRecording" | "resetSession">>) {
  useMeetingRecorderStore.setState(partial);
}

function clearTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function clearSegmentTimer() {
  if (segmentTimer !== null) {
    clearTimeout(segmentTimer);
    segmentTimer = null;
  }
}

function clearVadTimer() {
  if (vadTimer !== null) {
    clearInterval(vadTimer);
    vadTimer = null;
  }
}

function resetVoiceActivityCalibration() {
  noiseFloorRms = 0.006;
  adaptiveVadThreshold = MIN_VAD_RMS_THRESHOLD;
}

function cleanupMedia() {
  clearSegmentTimer();
  clearVadTimer();
  mediaRecorder = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  mediaStream = null;
  if (mediaSourceNode) {
    try {
      mediaSourceNode.disconnect();
    } catch {
      // noop
    }
  }
  if (analyserNode) {
    try {
      analyserNode.disconnect();
    } catch {
      // noop
    }
  }
  if (audioContext) {
    void audioContext.close().catch(() => undefined);
  }
  audioContext = null;
  analyserNode = null;
  mediaSourceNode = null;
  clearTimer();
  preferredMimeType = null;
  resetVoiceActivityCalibration();
}

function maybeFinishStopping() {
  const state = useMeetingRecorderStore.getState();
  if (state.status === "stopping" && !mediaRecorder && uploadQueue.length === 0 && !isUploading) {
    setStoreState({
      status: "idle",
      isUploading: false,
      queueLength: 0,
      participantLabel: null,
    });
  }
}

function getPreferredAudioMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  return PREFERRED_AUDIO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

function getFileExtensionForMimeType(mimeType: string | null | undefined) {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "audio/ogg":
      return ".ogg";
    case "audio/mp4":
      return ".mp4";
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
      return ".wav";
    case "audio/webm":
    default:
      return ".webm";
  }
}

function sampleCurrentAudioRms() {
  if (!analyserNode) {
    return 0;
  }

  const buffer = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(buffer);

  let sumSquares = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const normalized = (buffer[index]! - 128) / 128;
    sumSquares += normalized * normalized;
  }

  return Math.sqrt(sumSquares / buffer.length);
}

function updateAdaptiveVadThreshold(rms: number) {
  const boundedRms = Number.isFinite(rms) ? Math.max(0, rms) : 0;
  noiseFloorRms = noiseFloorRms === 0
    ? boundedRms
    : noiseFloorRms + (boundedRms - noiseFloorRms) * NOISE_FLOOR_SMOOTHING;
  adaptiveVadThreshold = Math.max(
    MIN_VAD_RMS_THRESHOLD,
    noiseFloorRms * NOISE_FLOOR_MULTIPLIER,
  );
}

async function calibrateNoiseFloor() {
  if (!analyserNode) {
    resetVoiceActivityCalibration();
    return;
  }

  const startedAt = Date.now();
  const samples: number[] = [];

  while (Date.now() - startedAt < NOISE_CALIBRATION_MS) {
    samples.push(sampleCurrentAudioRms());
    await new Promise((resolve) => setTimeout(resolve, NOISE_CALIBRATION_INTERVAL_MS));
  }

  const sorted = samples.filter(Number.isFinite).sort((left, right) => left - right);
  const median = sorted.length > 0
    ? sorted[Math.floor(sorted.length / 2)] ?? 0
    : 0;

  noiseFloorRms = Math.max(0.003, median);
  adaptiveVadThreshold = Math.max(
    MIN_VAD_RMS_THRESHOLD,
    noiseFloorRms * NOISE_FLOOR_MULTIPLIER,
  );
}

async function processQueue() {
  if (isUploading) return;

  const state = useMeetingRecorderStore.getState();
  if (!state.sessionId) return;

  isUploading = true;
  setStoreState({ isUploading: true });

  while (uploadQueue.length > 0) {
    const current = uploadQueue.shift()!;
    setStoreState({ queueLength: uploadQueue.length });

    const formData = new FormData();
    const fileExt = getFileExtensionForMimeType(current.mimeType || current.blob.type);
    formData.append("file", current.blob, `meeting-chunk-${current.chunkIndex}${fileExt}`);
    formData.append("sessionId", state.sessionId);
    formData.append("chunkIndex", String(current.chunkIndex));
    formData.append("chunkStartedAtMs", String(current.chunkStartedAtMs));
    formData.append("chunkEndedAtMs", String(current.chunkEndedAtMs));
    if (state.participantLabel) {
      formData.append("participantLabel", state.participantLabel);
    }

    try {
      const response = await fetch("/api/meeting/chunk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Chunk upload failed" }));
        throw new Error(typeof body.error === "string" ? body.error : "Chunk upload failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chunk upload failed";
      setStoreState({
        status: "error",
        error: message,
      });
      useToastStore.getState().addToast({
        type: "error",
        message,
      });
      break;
    }
  }

  isUploading = false;
  setStoreState({
    isUploading: false,
    queueLength: uploadQueue.length,
  });
  maybeFinishStopping();
}

function enqueueChunk(blob: Blob, mimeType?: string | null) {
  const elapsed = Date.now() - recordingStartedAt;
  uploadQueue.push({
    blob,
    mimeType: mimeType ?? blob.type ?? null,
    chunkIndex: nextChunkIndex,
    chunkStartedAtMs: nextChunkStartedAtMs,
    chunkEndedAtMs: elapsed,
  });
  nextChunkIndex += 1;
  nextChunkStartedAtMs = elapsed;
  setStoreState({ queueLength: uploadQueue.length });
  void processQueue();
}

async function waitForDrain() {
  while (uploadQueue.length > 0 || isUploading) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function handleRecorderFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Microphone recording failed";
  cleanupMedia();
  setStoreState({
    status: "error",
    error: message,
    isUploading: false,
  });
  useToastStore.getState().addToast({
    type: "error",
    message,
  });
}

function startSegmentRecorder() {
  const state = useMeetingRecorderStore.getState();
  if (!mediaStream || state.status !== "recording") {
    return;
  }

  const recorder = preferredMimeType
    ? new MediaRecorder(mediaStream, { mimeType: preferredMimeType })
    : new MediaRecorder(mediaStream);

  mediaRecorder = recorder;
  const blobParts: BlobPart[] = [];
  const segmentStartedAt = Date.now();
  let lastVoiceDetectedAt = segmentStartedAt;

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      blobParts.push(event.data);
    }
  };

  recorder.onerror = (event) => {
    const recorderError = "error" in event ? event.error : undefined;
    handleRecorderFailure(recorderError ?? new Error("Microphone recording failed"));
  };

  recorder.onstop = () => {
    clearSegmentTimer();
    clearVadTimer();
    if (mediaRecorder === recorder) {
      mediaRecorder = null;
    }

    const resolvedMimeType = recorder.mimeType || preferredMimeType || "audio/webm";
    if (blobParts.length > 0) {
      const blob = new Blob(blobParts, { type: resolvedMimeType });
      if (blob.size > 0) {
        enqueueChunk(blob, resolvedMimeType);
      }
    }

    const nextState = useMeetingRecorderStore.getState();
    if (nextState.status === "recording" && mediaStream) {
      startSegmentRecorder();
      return;
    }

    cleanupMedia();
    void waitForDrain().then(() => {
      maybeFinishStopping();
    });
  };

  recorder.start();
  clearVadTimer();
  vadTimer = setInterval(() => {
    if (recorder.state !== "recording") {
      return;
    }

    const now = Date.now();
    const elapsedMs = now - segmentStartedAt;
    const rms = sampleCurrentAudioRms();
    if (rms >= adaptiveVadThreshold) {
      lastVoiceDetectedAt = now;
      return;
    }

    updateAdaptiveVadThreshold(rms);

    if (elapsedMs >= MIN_CHUNK_DURATION_MS && now - lastVoiceDetectedAt >= SILENCE_HOLD_MS) {
      recorder.stop();
    }
  }, VAD_POLL_INTERVAL_MS);
  segmentTimer = setTimeout(() => {
    if (recorder.state === "recording") {
      recorder.stop();
    }
  }, MAX_CHUNK_DURATION_MS);
}

export const useMeetingRecorderStore = create<MeetingRecorderStore>((set, get) => ({
  status: "idle",
  pageId: null,
  sessionId: null,
  participantLabel: null,
  error: null,
  elapsedMs: 0,
  queueLength: 0,
  isUploading: false,

  startRecording: async ({ pageId, sessionId, participantLabel, initialChunkIndex, initialChunkStartedAtMs }) => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      throw new Error("Recording is only available in the browser");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support microphone recording");
    }

    if (mediaRecorder) {
      return;
    }

    set({
      status: "requesting_permission",
      pageId,
      sessionId,
      participantLabel: participantLabel?.trim() || null,
      error: null,
      elapsedMs: 0,
      queueLength: 0,
      isUploading: false,
    });

    try {
      resetVoiceActivityCalibration();
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
        },
      });
      preferredMimeType = getPreferredAudioMimeType();
      if (typeof window !== "undefined") {
        const BrowserAudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (BrowserAudioContext) {
          audioContext = new BrowserAudioContext();
          analyserNode = audioContext.createAnalyser();
          analyserNode.fftSize = 2048;
          analyserNode.smoothingTimeConstant = 0.75;
          mediaSourceNode = audioContext.createMediaStreamSource(mediaStream);
          mediaSourceNode.connect(analyserNode);
        }
      }
      await calibrateNoiseFloor();

      uploadQueue = [];
      nextChunkIndex = Math.max(0, initialChunkIndex ?? 0);
      nextChunkStartedAtMs = Math.max(0, initialChunkStartedAtMs ?? 0);
      recordingStartedAt = Date.now() - Math.max(0, initialChunkStartedAtMs ?? 0);

      timer = setInterval(() => {
        const current = get();
        if (current.status === "recording" || current.status === "stopping") {
          set({ elapsedMs: Date.now() - recordingStartedAt });
        }
      }, 1000);

      set({
        status: "recording",
        elapsedMs: 0,
      });

      startSegmentRecorder();
    } catch (error) {
      cleanupMedia();
      const message = error instanceof Error ? error.message : "Microphone access failed";
      set({
        status: "error",
        error: message,
      });
      throw error;
    }
  },

  stopRecording: async () => {
    if (!mediaRecorder) {
      cleanupMedia();
      set({
        status: "idle",
        participantLabel: null,
        isUploading: false,
        queueLength: 0,
      });
      return;
    }

    set({ status: "stopping" });
    clearSegmentTimer();
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      cleanupMedia();
    }
    await waitForDrain();
    maybeFinishStopping();
  },

  resetSession: () => {
    set({
      pageId: null,
      sessionId: null,
      participantLabel: null,
      error: null,
      elapsedMs: 0,
      queueLength: 0,
      isUploading: false,
      status: "idle",
    });
  },
}));

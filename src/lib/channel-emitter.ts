export type WorkspaceChannelStreamEvent =
  | {
      kind: "message.created";
      channelId: string;
      payload: {
        id: string;
        channelId: string;
        userId: string;
        content: string;
        type: string;
        metadata: Record<string, unknown>;
        createdAt: string;
        user: { id: string; name: string; avatarUrl: string | null };
      };
    }
  | {
      kind: "voice.presence.updated";
      channelId: string;
      payload: {
        channelId: string;
        activeParticipantCount: number;
      };
    }
  | {
      kind: "voice.signal";
      channelId: string;
      payload: {
        channelId: string;
        fromUserId: string;
        targetUserId: string | null;
        signalType: "offer" | "answer" | "ice-candidate" | "peer-left";
        data: unknown;
        timestamp: string;
      };
    }
  | {
      kind: "browser.session.updated";
      channelId: string;
      payload: {
        channelId: string;
        updatedAt: string;
      };
    };

type Listener = (event: WorkspaceChannelStreamEvent) => void;

class WorkspaceChannelEmitter {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(channelId: string, listener: Listener): () => void {
    if (!this.listeners.has(channelId)) {
      this.listeners.set(channelId, new Set());
    }

    this.listeners.get(channelId)!.add(listener);

    return () => {
      const bucket = this.listeners.get(channelId);
      if (!bucket) return;

      bucket.delete(listener);
      if (bucket.size === 0) {
        this.listeners.delete(channelId);
      }
    };
  }

  emit(event: WorkspaceChannelStreamEvent) {
    const bucket = this.listeners.get(event.channelId);
    if (!bucket) return;
    bucket.forEach((listener) => listener(event));
  }
}

export const workspaceChannelEmitter = new WorkspaceChannelEmitter();

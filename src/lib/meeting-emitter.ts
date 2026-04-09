export type MeetingEvent =
  | {
      type: "session.updated";
      pageId: string;
      sessionId: string;
      timestamp: string;
    }
  | {
      type: "utterance.created";
      pageId: string;
      sessionId: string;
      utteranceId: string;
      timestamp: string;
    }
  | {
      type: "snapshot.updated";
      pageId: string;
      sessionId: string;
      snapshotId: string;
      timestamp: string;
    };

type Listener = (event: MeetingEvent) => void;

class MeetingEmitter {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(pageId: string, listener: Listener): () => void {
    if (!this.listeners.has(pageId)) {
      this.listeners.set(pageId, new Set());
    }
    this.listeners.get(pageId)!.add(listener);

    return () => {
      const current = this.listeners.get(pageId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(pageId);
      }
    };
  }

  emit(event: MeetingEvent) {
    const current = this.listeners.get(event.pageId);
    if (!current) return;
    current.forEach((listener) => listener(event));
  }
}

export const meetingEmitter = new MeetingEmitter();

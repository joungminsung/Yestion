/**
 * In-memory pub/sub for real-time chat.
 */

export type ChatEvent = {
  id: string;
  pageId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  type?: string;
  metadata?: Record<string, unknown>;
};

type Listener = (event: ChatEvent) => void;

class ChatEmitter {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(pageId: string, listener: Listener): () => void {
    if (!this.listeners.has(pageId)) {
      this.listeners.set(pageId, new Set());
    }
    this.listeners.get(pageId)!.add(listener);
    return () => {
      const set = this.listeners.get(pageId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(pageId);
      }
    };
  }

  emit(event: ChatEvent) {
    const set = this.listeners.get(event.pageId);
    if (set) {
      set.forEach((listener) => listener(event));
    }
  }
}

export const chatEmitter = new ChatEmitter();

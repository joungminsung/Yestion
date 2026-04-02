import { get, set } from "idb-keyval";

export interface SyncOperation {
  id: string;
  type: "create" | "update" | "delete";
  entity: "page" | "block";
  entityId: string;
  payload: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = "offline-sync-queue";

export const syncQueue = {
  async getQueue(): Promise<SyncOperation[]> {
    return (await get<SyncOperation[]>(QUEUE_KEY)) ?? [];
  },

  async enqueue(op: Omit<SyncOperation, "id" | "timestamp" | "retries">): Promise<void> {
    const queue = await this.getQueue();
    queue.push({
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    });
    await set(QUEUE_KEY, queue);
  },

  async dequeue(id: string): Promise<void> {
    const queue = await this.getQueue();
    await set(
      QUEUE_KEY,
      queue.filter((op) => op.id !== id),
    );
  },

  async incrementRetry(id: string): Promise<void> {
    const queue = await this.getQueue();
    const op = queue.find((o) => o.id === id);
    if (op) {
      op.retries += 1;
      await set(QUEUE_KEY, queue);
    }
  },

  async flush(
    executor: (op: SyncOperation) => Promise<boolean>,
  ): Promise<{ success: number; failed: number }> {
    const queue = await this.getQueue();
    let success = 0;
    let failed = 0;

    for (const op of queue) {
      if (op.retries >= 5) {
        failed++;
        continue;
      }
      try {
        const ok = await executor(op);
        if (ok) {
          await this.dequeue(op.id);
          success++;
        } else {
          await this.incrementRetry(op.id);
          failed++;
        }
      } catch {
        await this.incrementRetry(op.id);
        failed++;
      }
    }
    return { success, failed };
  },

  async clear(): Promise<void> {
    await set(QUEUE_KEY, []);
  },

  async size(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};

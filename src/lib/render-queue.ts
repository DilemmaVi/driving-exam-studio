type Job = { taskId: string; fn: () => Promise<void> };

class RenderQueue {
  private queue: Job[] = [];
  private running = false;

  enqueue(taskId: string, fn: () => Promise<void>) {
    this.queue.push({ taskId, fn });
    this.process();
  }

  private async process() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        try {
          await job.fn();
        } catch (e) {
          console.error(`[RenderQueue] Task ${job.taskId} failed:`, e);
        }
      }
    } finally {
      this.running = false;
    }
  }

  getPosition(taskId: string): number {
    const idx = this.queue.findIndex((j) => j.taskId === taskId);
    return idx === -1 ? 0 : idx + 1;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

const g = globalThis as unknown as { __renderQueue?: RenderQueue };
if (!g.__renderQueue) g.__renderQueue = new RenderQueue();
export const renderQueue = g.__renderQueue;

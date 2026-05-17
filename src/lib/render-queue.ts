import type { ChildProcess } from "child_process";

type Job = { taskId: string; fn: () => Promise<void> };

const RENDER_TIMEOUT_MS = 30 * 60 * 1000;

class RenderQueue {
  private queue: Job[] = [];
  private running = false;
  private currentTaskId: string | null = null;
  private currentProcess: ChildProcess | null = null;

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
        this.currentTaskId = job.taskId;
        try {
          await Promise.race([
            job.fn(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("渲染超时（超过30分钟）")), RENDER_TIMEOUT_MS)
            ),
          ]);
        } catch (e) {
          console.error(`[RenderQueue] Task ${job.taskId} failed:`, e);
        }
        this.currentTaskId = null;
        this.currentProcess = null;
      }
    } finally {
      this.running = false;
      this.currentTaskId = null;
      this.currentProcess = null;
    }
  }

  cancel(taskId: string): boolean {
    const idx = this.queue.findIndex((j) => j.taskId === taskId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    if (this.currentTaskId === taskId && this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      return true;
    }
    return false;
  }

  setCurrentProcess(proc: ChildProcess) {
    this.currentProcess = proc;
  }

  getCurrentTaskId(): string | null {
    return this.currentTaskId;
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

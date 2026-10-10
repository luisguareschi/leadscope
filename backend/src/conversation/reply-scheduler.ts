import type { Logger } from "../lib/logger.js";

/**
 * Waits for a lead to stop typing, then runs one turn per thread at a time.
 * A burst of messages gets a single reply. A message that arrives while a turn is running
 * triggers one more run afterwards. Pending work is also in the database (unhandled inbound
 * messages), so a restart loses nothing: the sweeper schedules it again.
 */
export class ReplyScheduler {
  private readonly timers = new Map<string, { timer: NodeJS.Timeout; firstAt: number }>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly rerun = new Set<string>();

  constructor(
    private readonly handler: (threadId: string) => Promise<void>,
    private readonly options: { debounceMs: number; maxWaitMs: number; logger: Logger },
  ) {}

  schedule(threadId: string): void {
    const existing = this.timers.get(threadId);
    if (existing) clearTimeout(existing.timer);
    const firstAt = existing?.firstAt ?? Date.now();
    const deadline = firstAt + this.options.maxWaitMs;
    const delay = Math.max(0, Math.min(this.options.debounceMs, deadline - Date.now()));
    const timer = setTimeout(() => {
      this.timers.delete(threadId);
      this.run(threadId);
    }, delay);
    this.timers.set(threadId, { timer, firstAt });
  }

  isBusy(threadId: string): boolean {
    return this.timers.has(threadId) || this.running.has(threadId);
  }

  private run(threadId: string): void {
    if (this.running.has(threadId)) {
      this.rerun.add(threadId);
      return;
    }
    const task = this.handler(threadId)
      .catch((error: unknown) => this.options.logger.error({ err: error, threadId }, "thread turn failed"))
      .finally(() => {
        this.running.delete(threadId);
        if (this.rerun.delete(threadId)) this.run(threadId);
      });
    this.running.set(threadId, task);
  }

  /** Runs everything that is waiting now and resolves when no turn is running. Tests and shutdown use it. */
  async drain(): Promise<void> {
    for (const [threadId, { timer }] of this.timers) {
      clearTimeout(timer);
      this.timers.delete(threadId);
      this.run(threadId);
    }
    while (this.running.size > 0) {
      await Promise.all([...this.running.values()]);
    }
  }

  stop(): void {
    for (const { timer } of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

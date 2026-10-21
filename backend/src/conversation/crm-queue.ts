import type { Logger } from "../lib/logger.js";

/**
 * Runs CRM writes in the background, one at a time per thread, so neither the webhook nor a reply
 * waits for HubSpot. A request that arrives while that thread's write runs gets one more run
 * afterwards. The outbox is in the database, so a restart loses nothing: the sweeper retries it.
 */
export class CrmQueue {
  private readonly running = new Map<string, Promise<void>>();
  private readonly rerun = new Set<string>();

  constructor(
    private readonly handler: (threadId: string) => Promise<void>,
    private readonly logger: Logger,
  ) {}

  schedule(threadId: string): void {
    if (this.running.has(threadId)) {
      this.rerun.add(threadId);
      return;
    }
    const task = this.handler(threadId)
      .catch((error: unknown) =>
        this.logger.error({ err: error, threadId }, "crm write failed"),
      )
      .finally(() => {
        this.running.delete(threadId);
        if (this.rerun.delete(threadId)) this.schedule(threadId);
      });
    this.running.set(threadId, task);
  }

  isBusy(threadId: string): boolean {
    return this.running.has(threadId);
  }

  /** Resolves when no write is running. Tests and shutdown use it. */
  async drain(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all([...this.running.values()]);
    }
  }
}

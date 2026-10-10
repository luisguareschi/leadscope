/** Groups a burst of inbound messages on one thread into a single later run. */
export class BurstQueue {
  private timers = new Map<string, NodeJS.Timeout>();
  private chain = new Map<string, Promise<void>>();

  constructor(
    private readonly delayMs: number,
    private readonly handle: (threadId: string) => Promise<void>,
  ) {}

  push(threadId: string): void {
    const existing = this.timers.get(threadId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.timers.delete(threadId);
      this.enqueue(threadId);
    }, this.delayMs);
    this.timers.set(threadId, timer);
  }

  private enqueue(threadId: string): void {
    const previous = this.chain.get(threadId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.handle(threadId));
    this.chain.set(threadId, next);
  }

  async flush(): Promise<void> {
    for (const [threadId, timer] of this.timers) {
      clearTimeout(timer);
      this.timers.delete(threadId);
      this.enqueue(threadId);
    }
    await Promise.all([...this.chain.values()]);
  }
}

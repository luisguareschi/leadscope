const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Free-form replies only. v1 does not send a follow-up after this window. Templates are separate. */
export function withinSessionWindow(lastInboundAt: Date | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() <= WINDOW_MS;
}

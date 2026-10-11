/** WhatsApp allows free-form replies only within 24 hours of the lead's last message. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinReplyWindow(lastInboundAt: Date | null, now: Date): boolean {
  return lastInboundAt !== null && now.getTime() - lastInboundAt.getTime() < REPLY_WINDOW_MS;
}

export function replyWindowClosesAt(lastInboundAt: Date | null): Date | null {
  return lastInboundAt ? new Date(lastInboundAt.getTime() + REPLY_WINDOW_MS) : null;
}

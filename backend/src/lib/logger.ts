import pino from "pino";
import { REDACTED_KEYS } from "./redacted-keys.js";

function toRedactSegment(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `["${key}"]`;
}

const REDACT_PATHS = REDACTED_KEYS.flatMap((key) => {
  const seg = toRedactSegment(key);
  const nested = seg.startsWith("[") ? `*${seg}` : `*.${seg}`;
  return [seg, nested];
});

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;

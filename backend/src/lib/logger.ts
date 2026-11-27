import pino from "pino";
import { REDACTED_KEYS } from "./redacted-keys.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: {
    paths: [...REDACTED_KEYS, ...REDACTED_KEYS.map((key) => `*.${key}`)],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;

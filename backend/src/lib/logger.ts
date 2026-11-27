import pino from "pino";

// Conversations are personal data (Ley 18.331): never log message text, phone numbers, or emails.
const REDACTED_KEYS = [
  "phone",
  "waId",
  "bsuid",
  "from_user_id",
  "business_scoped_user_id",
  "username",
  "to",
  "recipient",
  "from",
  "body",
  "text",
  "email",
  "name",
  "reply",
  "authorization",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: {
    paths: [...REDACTED_KEYS, ...REDACTED_KEYS.map((key) => `*.${key}`)],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;

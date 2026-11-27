// Conversations are personal data (Ley 18.331): never log message text, phone numbers, or emails.
export const REDACTED_KEYS = [
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
] as const;

import { createHmac } from "crypto";
import { safeEqual } from "../../crypto/secrets";

export function signBody(rawBody: Buffer, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

export function verifyMetaSignature(
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header || !appSecret) return false;
  return safeEqual(signBody(rawBody, appSecret), header);
}

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

function parse(value: string, defaultCountry?: string): string | null {
  const parsed = parsePhoneNumberFromString(value, defaultCountry as CountryCode | undefined);
  return parsed?.isValid() ? parsed.number : null;
}

/**
 * Normalizes a phone typed in a form to E.164, so a form contact and a WhatsApp contact match.
 * Accepts "+598 99 123 456", "0059899123456", national "099 123 456", or "59899123456".
 */
export function toE164(raw: string, defaultCountry?: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return parse(`+${digits}`);
  if (trimmed.startsWith("00")) return parse(`+${digits.slice(2)}`);
  return parse(trimmed, defaultCountry) ?? parse(`+${digits}`);
}

/** WhatsApp sends the lead's number as international digits with no plus sign. */
export function waIdToE164(waId: string): string | null {
  const digits = waId.replace(/\D/g, "");
  return digits ? parse(`+${digits}`) : null;
}

export function e164ToWaId(e164: string): string {
  return e164.replace(/\D/g, "");
}

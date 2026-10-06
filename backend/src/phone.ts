/** WhatsApp `from` and form phones must already include a country code. No country is assumed. */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** "ana@altamira.uy" → "ana". Operators only have an email; the panel names them the same way. */
export function operatorName(email: string): string {
  return email.replace(/@.*/, "");
}

/**
 * Who wrote a message from the panel: the operator's name, or the full email of a platform admin
 * in support access (they are not one of the company's advisors).
 */
export function senderLabel(sender: {
  sentByEmail: string;
  sentBySupport: boolean;
}): string {
  return sender.sentBySupport
    ? sender.sentByEmail
    : operatorName(sender.sentByEmail);
}

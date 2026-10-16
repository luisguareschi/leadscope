import { decryptSecrets } from "../../companies/company-secrets.js";
import type { AppContext } from "../../context.js";
import {
  applyStatusUpdate,
  recordInboundMessage,
} from "../../conversation/inbound.js";
import { isValidKapsoSignature } from "../../integrations/whatsapp/kapso/kapso-signature.js";
import { parseKapsoWebhook } from "../../integrations/whatsapp/kapso/kapso-webhook.js";
import { badRequest, HttpError, notFound } from "../../lib/http-error.js";

const invalidSignature = () =>
  new HttpError(401, "invalid signature", "invalid_signature");

/**
 * One Kapso webhook delivery for one company. The URL names the company, so its own webhook secret
 * verifies the body; then only events for that company's number are stored. Everything is stored
 * before the 200 goes back: if the database is down Kapso retries (twice, over ~50 s).
 */
export async function receiveKapsoWebhook(
  ctx: AppContext,
  input: {
    companySlug: string;
    rawBody: Buffer;
    signature: string | undefined;
    event: string | undefined;
  },
): Promise<{ threadIds: string[] }> {
  const company = await ctx.db.company.findUnique({
    where: { slug: input.companySlug },
    select: {
      id: true,
      archivedAt: true,
      encryptedSecrets: true,
      whatsappPhoneNumberId: true,
    },
  });
  if (!company) throw notFound("Empresa no encontrada");
  const secret = decryptSecrets(
    company.encryptedSecrets,
    ctx.encryptionKey,
  ).kapsoWebhookSecret;
  if (!secret) {
    ctx.logger.warn(
      { companyId: company.id },
      "kapso webhook for a company with no webhook secret; refused",
    );
    throw invalidSignature();
  }
  if (!isValidKapsoSignature(input.rawBody, input.signature, secret))
    throw invalidSignature();

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody.toString("utf8"));
  } catch {
    throw badRequest("invalid json", "invalid_json");
  }
  // Archived: the number is ignored, as if it belonged to no company. Nothing is stored.
  if (company.archivedAt) {
    ctx.logger.info(
      { companyId: company.id },
      "kapso webhook for an archived company; ignored",
    );
    return { threadIds: [] };
  }

  const { messages, statuses, withoutPhone } = parseKapsoWebhook(
    input.event,
    payload,
  );
  if (withoutPhone > 0) {
    ctx.logger.warn(
      { companyId: company.id, count: withoutPhone },
      "kapso inbound message with no phone number (BSUID only); not stored",
    );
  }
  const ownNumber = (phoneNumberId: string) => {
    if (phoneNumberId === company.whatsappPhoneNumberId) return true;
    ctx.logger.warn(
      {
        companyId: company.id,
        phoneNumberId,
        expected: company.whatsappPhoneNumberId,
      },
      "kapso webhook for a number that is not this company's; ignored",
    );
    return false;
  };

  const threadIds = new Set<string>();
  for (const message of messages) {
    if (!ownNumber(message.phoneNumberId)) continue;
    const result = await recordInboundMessage(ctx, message);
    if (result.status === "recorded" && result.needsReply)
      threadIds.add(result.threadId);
  }
  for (const status of statuses) {
    if (!ownNumber(status.phoneNumberId)) continue;
    await applyStatusUpdate(ctx, company.id, status);
  }
  return { threadIds: [...threadIds] };
}

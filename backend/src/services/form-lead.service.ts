import { PrismaClient } from "@prisma/client";
import { readCompany } from "../companies/load";
import { addMessage } from "../conversation/messages";
import { safeEqual } from "../crypto/secrets";
import { Channel } from "../integrations/channel";
import { log } from "../logger";
import { toE164 } from "../phone";

export type FormLeadDeps = {
  db: PrismaClient;
  key: Buffer | null;
  channel: Channel;
};

export async function acceptFormLead(
  deps: FormLeadDeps,
  input: { secret: string; phone: string; email?: string; hubspotContactId?: string },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const rows = await deps.db.company.findMany();
  const company = rows
    .map((row) => readCompany(row, deps.key))
    .find((candidate) => candidate.secrets.formLeadSecret && safeEqual(candidate.secrets.formLeadSecret, input.secret));
  if (!company) return { ok: false, status: 401, error: "unauthorized" };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, status: 400, error: "phone must include a country code" };

  const existing = await deps.db.thread.findUnique({
    where: { companyId_phone: { companyId: company.id, phone } },
  });
  if (existing) {
    await deps.db.thread.update({
      where: { id: existing.id },
      data: {
        email: input.email ?? existing.email,
        crmContactId: input.hubspotContactId ?? existing.crmContactId,
      },
    });
    return { ok: true };
  }

  const thread = await deps.db.thread.create({
    data: {
      companyId: company.id,
      phone,
      state: "Qualify",
      email: input.email ?? null,
      crmContactId: input.hubspotContactId ?? null,
    },
  });
  const template = company.config.whatsapp.welcomeTemplateName;
  if (!template) {
    log.warn({ companyId: company.id, threadId: thread.id }, "welcome template name is not configured");
    return { ok: true };
  }
  const sent = await deps.channel.sendTemplate({
    to: phone,
    templateName: template,
    language: company.config.whatsapp.templateLanguage,
    phoneNumberId: company.whatsappPhoneNumberId ?? company.config.whatsapp.phoneNumberId,
    accessToken: company.secrets.metaAccessToken,
  });
  await addMessage(deps.db, {
    companyId: company.id,
    threadId: thread.id,
    direction: "out",
    body: `template:${template}`,
    contentType: "template",
    whatsappMessageId: sent.messageId,
  });
  return { ok: true };
}

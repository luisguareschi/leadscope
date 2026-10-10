import { z } from "zod";
import { loadCompany } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { messagePreview } from "../../conversation/inbound.js";
import { withThreadLease } from "../../conversation/thread-lease.js";
import { safeEqual } from "../../lib/crypto.js";
import { badRequest, HttpError, notFound } from "../../lib/http-error.js";
import { e164ToWaId, toE164 } from "../../lib/phone.js";
import { isUniqueViolation } from "../../lib/prisma.js";

const text = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .optional();

/**
 * Accepts our own shape and HubSpot's "Send a webhook" shape (contact properties as top-level keys).
 * Phone is required; email, name, and the HubSpot contact id are optional.
 */
const formLeadSchema = z
  .object({
    phone: text,
    mobilephone: text,
    hs_whatsapp_phone_number: text,
    email: text,
    name: text,
    firstname: text,
    lastname: text,
    crmContactId: text,
    hs_object_id: text,
    objectId: text,
  })
  .loose()
  .transform((body) => ({
    phone: body.phone || body.mobilephone || body.hs_whatsapp_phone_number || "",
    email: body.email?.toLowerCase() || null,
    name: body.name || [body.firstname, body.lastname].filter(Boolean).join(" ") || null,
    crmContactId: body.crmContactId || body.hs_object_id || body.objectId || null,
  }));

export type FormLeadResult = {
  threadId: string;
  welcome: "sent" | "already_in_conversation" | "no_template";
};

async function upsertFormThread(
  ctx: AppContext,
  companyId: string,
  lead: { phone: string; email: string | null; name: string | null; crmContactId: string | null },
) {
  const upsert = () =>
    ctx.db.thread.upsert({
      where: { companyId_phone: { companyId, phone: lead.phone } },
      create: {
        companyId,
        phone: lead.phone,
        waId: e164ToWaId(lead.phone),
        source: "form",
        name: lead.name,
        email: lead.email,
        crmContactId: lead.crmContactId,
      },
      update: {
        ...(lead.email ? { email: lead.email } : {}),
        ...(lead.crmContactId ? { crmContactId: lead.crmContactId } : {}),
      },
    });
  try {
    return await upsert();
  } catch (error) {
    if (isUniqueViolation(error)) return upsert();
    throw error;
  }
}

/** A lead filled a form: send the approved welcome template once, then the normal flow takes over. */
export async function createFormLead(
  ctx: AppContext,
  input: { companySlug: string; secret: string | undefined; body: unknown },
): Promise<FormLeadResult> {
  const row = await ctx.db.company.findUnique({ where: { slug: input.companySlug } });
  if (!row) throw notFound("Empresa no encontrada");
  const company = loadCompany(row, ctx.encryptionKey);
  const expected = company.secrets.formLeadSecret;
  if (!expected || !input.secret || !safeEqual(input.secret, expected)) {
    throw new HttpError(401, "Invalid form-lead secret", "unauthorized");
  }

  const parsed = formLeadSchema.safeParse(input.body ?? {});
  if (!parsed.success) throw badRequest("Invalid form-lead payload");
  const phone = toE164(parsed.data.phone, company.config.defaultCountry);
  if (!phone) throw badRequest("A valid phone number is required", "invalid_phone");

  const thread = await upsertFormThread(ctx, company.id, { ...parsed.data, phone });

  const leased = await withThreadLease(ctx, thread.id, async (): Promise<FormLeadResult> => {
    const messageCount = await ctx.db.message.count({ where: { threadId: thread.id } });
    if (messageCount > 0) return { threadId: thread.id, welcome: "already_in_conversation" };
    const template = company.config.whatsapp.welcomeTemplate;
    if (!template) return { threadId: thread.id, welcome: "no_template" };

    let waMessageId: string;
    try {
      ({ waMessageId } = await ctx.integrations
        .channelFor(company)
        .sendTemplate({ to: thread.waId, name: template.name, language: template.language }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new HttpError(502, `WhatsApp did not send the welcome template: ${reason}`, "whatsapp_error");
    }
    const body = template.bodyPreview || `[Plantilla de bienvenida: ${template.name}]`;
    const sentAt = ctx.now();
    await ctx.db.$transaction([
      ctx.db.message.create({
        data: {
          companyId: company.id,
          threadId: thread.id,
          direction: "outbound",
          type: "template",
          body,
          waMessageId,
          status: "sent",
          sentAt,
        },
      }),
      ctx.db.thread.update({
        where: { id: thread.id },
        data: { state: "qualify", lastMessageAt: sentAt, lastMessagePreview: messagePreview("template", body) },
      }),
    ]);
    return { threadId: thread.id, welcome: "sent" };
  });
  // Another delivery of the same form lead holds the thread right now; it will send the welcome.
  return leased.claimed ? leased.result : { threadId: thread.id, welcome: "already_in_conversation" };
}

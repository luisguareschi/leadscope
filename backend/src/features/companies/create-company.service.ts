import { parseCompanyConfig } from "../../companies/company-config.js";
import {
  starterCompanyConfig,
  starterInstructions,
} from "../../companies/starter-config.js";
import type { AppContext } from "../../context.js";
import { conflict } from "../../lib/http-error.js";
import { isUniqueViolation } from "../../lib/prisma.js";
import { inviteOperator } from "../operators/invite-operator.js";
import { companySelect, toCompanyDto } from "./company-dto.js";

export type CreateCompanyInput = {
  name: string;
  slug: string;
  operatorEmail: string;
};

function uniqueFields(error: unknown): string {
  if (!isUniqueViolation(error) || typeof error !== "object" || error === null)
    return "";
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.map(String).join(" ");
  return typeof target === "string" ? target : "";
}

/**
 * Company row, slug, name, starter config and instructions, no WhatsApp number yet (each saved as its
 * first version), and the first operator, who gets the Supabase invitation like any operator added
 * later. Secrets stay empty; that company's operator sets them later from Configuración. Does not
 * move an email that already belongs to a company.
 */
export async function createCompany(
  ctx: AppContext,
  input: CreateCompanyInput,
  adminEmail: string,
  panelOrigin: string,
) {
  const slugTaken = await ctx.db.company.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (slugTaken)
    throw conflict(
      "Ya existe una empresa con ese identificador.",
      "slug_taken",
    );

  const emailTaken = await ctx.db.operator.findUnique({
    where: { email: input.operatorEmail },
    select: { id: true },
  });
  if (emailTaken)
    throw conflict("Ese email ya es operador de una empresa.", "email_taken");

  const config = parseCompanyConfig(starterCompanyConfig(input.name));
  const instructions = starterInstructions(input.name);
  try {
    const company = await ctx.db.company.create({
      data: {
        name: input.name,
        slug: input.slug,
        config,
        instructions,
        operators: { create: { email: input.operatorEmail } },
        settingsVersions: {
          create: [
            { kind: "config", config, createdByEmail: adminEmail },
            { kind: "instructions", instructions, createdByEmail: adminEmail },
            {
              kind: "companyName",
              companyName: input.name,
              createdByEmail: adminEmail,
            },
            {
              kind: "whatsappPhoneNumberId",
              whatsappPhoneNumberId: null,
              createdByEmail: adminEmail,
            },
          ],
        },
      },
      select: companySelect,
    });
    const [operator] = company.operators;
    const invite = operator
      ? await inviteOperator(ctx, operator, { resend: false, panelOrigin })
      : null;
    return { company: toCompanyDto(company), invite };
  } catch (error) {
    const fields = uniqueFields(error);
    if (fields.includes("slug"))
      throw conflict(
        "Ya existe una empresa con ese identificador.",
        "slug_taken",
      );
    if (fields.includes("email"))
      throw conflict("Ese email ya es operador de una empresa.", "email_taken");
    if (isUniqueViolation(error))
      throw conflict(
        "Esa empresa o ese operador ya existen.",
        "already_exists",
      );
    throw error;
  }
}

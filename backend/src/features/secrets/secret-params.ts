import { z } from "zod";
import {
  COMPANY_SECRET_NAMES,
  type CompanySecretName,
} from "../../companies/company-secrets.js";

export function isCompanySecretName(value: string): value is CompanySecretName {
  return (COMPANY_SECRET_NAMES as readonly string[]).includes(value);
}

export const secretParamsSchema = z.object({
  name: z.string().refine(isCompanySecretName, { message: "desconocido" }),
});

/** A blank value is rejected here so it cannot be used to wipe a stored secret. */
export const setSecretBodySchema = z.object({
  value: z
    .string()
    .max(8_000)
    .refine((value) => value.trim().length > 0, { message: "está vacío" })
    .transform((value) => value.trim()),
});

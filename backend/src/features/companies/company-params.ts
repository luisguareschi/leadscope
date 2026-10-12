import { z } from "zod";

/** Lower-case slug used in the form-lead URL, e.g. `altamira`. */
export const companySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const operatorEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Email inválido" }));

export const createCompanyBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: companySlugSchema,
  operatorEmail: operatorEmailSchema,
});

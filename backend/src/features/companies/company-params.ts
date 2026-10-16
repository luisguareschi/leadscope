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

export const listCompaniesQuerySchema = z.object({
  /** `active` (default) hides archived companies. */
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export const companyParamsSchema = z.object({
  companyId: z.string().min(1),
});

/** Deleting asks for the company's slug, typed by hand. */
export const deleteCompanyBodySchema = z.object({
  confirmSlug: z.string().trim().toLowerCase().default(""),
});

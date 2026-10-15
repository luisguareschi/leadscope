import { z } from "zod";
import { operatorEmailSchema } from "../companies/company-params.js";

export const companyOperatorsParamsSchema = z.object({
  companyId: z.string().min(1),
});

export const operatorParamsSchema = z.object({
  companyId: z.string().min(1),
  operatorId: z.string().min(1),
});

export const addOperatorBodySchema = z.object({ email: operatorEmailSchema });

import type { z } from "zod";
import { HttpError } from "../lib/http-error.js";

export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    throw new HttpError(400, `Datos inválidos (${detail})`, "invalid_input");
  }
  return result.data;
}

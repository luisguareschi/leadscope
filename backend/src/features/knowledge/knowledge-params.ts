import { z } from "zod";

export const fileParamsSchema = z.object({ id: z.string().min(1).max(64) });

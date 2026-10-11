import { z } from "zod";

export const threadParamsSchema = z.object({ id: z.string().min(1).max(64) });

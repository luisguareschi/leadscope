import { z } from "zod";

export const fileParamsSchema = z.object({ id: z.string().min(1).max(64) });

export const folderParamsSchema = z.object({ id: z.string().min(1).max(64) });

/** A folder id, or null for the root. */
export const folderRefSchema = z.string().min(1).max(64).nullable();

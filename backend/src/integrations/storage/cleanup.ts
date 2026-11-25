import type { AppContext } from "../../context.js";

/**
 * Deletes binaries from object storage only when no `KnowledgeFile` or `Message` row still
 * references their path. Prevents replacing/deleting a knowledge file from breaking historical
 * sent attachments in conversations, while still garbage-collecting unused objects.
 */
export async function removeStorageIfUnreferenced(
  ctx: AppContext,
  candidatePaths: Array<string | null | undefined>,
): Promise<void> {
  const unique = [
    ...new Set(
      candidatePaths.filter((p): p is string => Boolean(p && p.trim())),
    ),
  ];
  if (unique.length === 0) return;

  const [inMessages, inKnowledge] = await Promise.all([
    ctx.db.message.findMany({
      where: { mediaPath: { in: unique } },
      select: { mediaPath: true },
      distinct: ["mediaPath"],
    }),
    ctx.db.knowledgeFile.findMany({
      where: { storagePath: { in: unique } },
      select: { storagePath: true },
      distinct: ["storagePath"],
    }),
  ]);
  const referenced = new Set<string>([
    ...inMessages
      .map((m) => m.mediaPath)
      .filter((p): p is string => Boolean(p)),
    ...inKnowledge
      .map((f) => f.storagePath)
      .filter((p): p is string => Boolean(p)),
  ]);
  const unreferenced = unique.filter((path) => !referenced.has(path));
  if (unreferenced.length > 0) {
    await ctx.storage.remove(unreferenced).catch((error) => {
      ctx.logger.warn(
        { err: error, count: unreferenced.length },
        "failed to remove unreferenced storage objects",
      );
    });
  }
}

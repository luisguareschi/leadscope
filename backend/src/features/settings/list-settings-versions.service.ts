import type { AppContext } from "../../context.js";
import { SettingsKind } from "../../generated/prisma/enums.js";
import { toSettingsVersionDto } from "./settings-dto.js";

const MAX_VERSIONS = 100;

/** Newest first, every kind together. */
export async function listSettingsVersions(ctx: AppContext, companyId: string) {
  const versions = await ctx.db.companySettingsVersion.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_VERSIONS,
  });
  const currentIds = new Set(
    Object.values(SettingsKind)
      .map((kind) => versions.find((version) => version.kind === kind)?.id)
      .filter((id): id is string => id !== undefined),
  );
  return {
    versions: versions.map((version) =>
      toSettingsVersionDto(version, currentIds.has(version.id)),
    ),
  };
}

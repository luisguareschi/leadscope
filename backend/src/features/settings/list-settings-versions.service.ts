import type { AppContext } from "../../context.js";
import { toSettingsVersionDto } from "./settings-dto.js";

const MAX_VERSIONS = 100;

/** Newest first, config and instructions together. */
export async function listSettingsVersions(ctx: AppContext, companyId: string) {
  const versions = await ctx.db.companySettingsVersion.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_VERSIONS,
  });
  const currentIds = new Set(
    (["config", "instructions"] as const)
      .map((kind) => versions.find((version) => version.kind === kind)?.id)
      .filter((id): id is string => id !== undefined),
  );
  return {
    versions: versions.map((version) =>
      toSettingsVersionDto(version, currentIds.has(version.id)),
    ),
  };
}

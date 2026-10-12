import type { CompanySettingsVersion } from "../../generated/prisma/client.js";

/** `current` marks the newest version of its kind: the one the company runs on now. */
export function toSettingsVersionDto(
  version: CompanySettingsVersion,
  current: boolean,
) {
  return {
    id: version.id,
    kind: version.kind,
    createdAt: version.createdAt,
    createdByEmail: version.createdByEmail,
    viaSupport: version.viaSupport,
    restoredFromId: version.restoredFromId,
    current,
    config: version.kind === "config" ? version.config : null,
    instructions: version.kind === "instructions" ? version.instructions : null,
    whatsappPhoneNumberId:
      version.kind === "whatsappPhoneNumberId"
        ? version.whatsappPhoneNumberId
        : null,
  };
}

export type SettingsVersionDto = ReturnType<typeof toSettingsVersionDto>;

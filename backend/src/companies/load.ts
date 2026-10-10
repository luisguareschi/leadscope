import { Prisma } from "@prisma/client";
import { CompanySecrets, decryptSecrets } from "../crypto/secrets";
import { CompanyConfig, parseCompanyConfig } from "./config";

/** A company row with config parsed and secrets decrypted. Not a database wrapper. */
export type CompanyView = {
  id: string;
  name: string;
  config: CompanyConfig;
  secrets: CompanySecrets;
  whatsappPhoneNumberId: string | null;
};

export function readCompany(
  row: {
    id: string;
    name: string;
    config: Prisma.JsonValue;
    encryptedSecrets: string | null;
    whatsappPhoneNumberId: string | null;
  },
  key: Buffer | null,
): CompanyView {
  return {
    id: row.id,
    name: row.name,
    config: parseCompanyConfig(row.config),
    secrets: decryptSecrets(row.encryptedSecrets, key),
    whatsappPhoneNumberId: row.whatsappPhoneNumberId,
  };
}

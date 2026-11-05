"use client";

import { useSecrets } from "@/lib/queries";
import type { SecretName } from "@/lib/types";

/** One company secret's write-only status; undefined while loading. */
export function useSecret(name: SecretName) {
  const query = useSecrets();
  return query.data?.secrets.find((secret) => secret.name === name);
}

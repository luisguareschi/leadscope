"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/queries";
import type { Me } from "@/lib/types";

/** Company pages exist only when this login has an operator row. */
export function hasCompany(me: Me | undefined): boolean {
  return me?.company != null;
}

export function isPlatformAdmin(me: Me | undefined): boolean {
  return me?.platformAdmin === true;
}

/** Platform admin who has not been added as an operator of any company. */
export function isCompanyLessAdmin(me: Me | undefined): boolean {
  return isPlatformAdmin(me) && !hasCompany(me);
}

/**
 * Conversaciones, Conocimiento, and Integraciones. A company-less admin is sent
 * to Empresas and these pages do not fetch.
 */
export function useCompanyPages() {
  const me = useMe();
  const router = useRouter();
  const blocked = isCompanyLessAdmin(me.data);

  useEffect(() => {
    if (blocked) router.replace("/companies");
  }, [blocked, router]);

  return { blocked, enabled: !blocked && me.isSuccess };
}

"use client";

import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveCompany } from "@/lib/support";

export function SupportBar({ companyName }: { companyName: string }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 md:rounded-t-xl lg:px-6 dark:text-amber-100"
    >
      <p className="flex min-w-0 items-center gap-2">
        <ShieldAlertIcon className="size-4 shrink-0" />
        <span className="truncate">
          Viendo como administrador:{" "}
          <span className="font-semibold">{companyName}</span>
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-500/40 bg-background/70"
        onClick={leaveCompany}
      >
        <ArrowLeftIcon />
        Volver a Empresas
      </Button>
    </div>
  );
}

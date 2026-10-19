"use client";

import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveCompany } from "@/lib/support";

export function SupportBar({ companyName }: { companyName: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 shadow-xs">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 ring-inset">
          <ShieldCheckIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] leading-tight text-muted-foreground">
            Viendo como administrador:
          </span>
          <span className="truncate text-sm leading-tight font-medium">
            {companyName}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        onClick={leaveCompany}
      >
        <ArrowLeftIcon />
        Volver a Empresas
      </Button>
    </div>
  );
}

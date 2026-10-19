"use client";

import { ArrowLeftIcon, ShieldIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveCompany } from "@/lib/support";

export function SupportBar({ companyName }: { companyName: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex min-w-0 gap-2">
        <ShieldIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          Viendo como administrador:{" "}
          <span className="font-medium text-foreground">{companyName}</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full bg-background"
        onClick={leaveCompany}
      >
        <ArrowLeftIcon />
        Volver a Empresas
      </Button>
    </div>
  );
}

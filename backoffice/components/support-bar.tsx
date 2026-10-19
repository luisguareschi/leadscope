"use client";

import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveCompany } from "@/lib/support";
import { Card } from "./ui/card";

export function SupportBar({ companyName }: { companyName: string }) {
  return (
    <Card className="p-3 flex flex-col gap-2">
      <p className="flex min-w-0 items-center gap-2 font-semibold">
        <ShieldAlertIcon className="size-4 shrink-0" />
        Modo Admin
      </p>
      <p className="text-sm text-muted-foreground mb-2">
        Estas viendo como administrador de{" "}
        <span className="font-semibold text-foreground">{companyName}</span>
      </p>
      <Button size="sm" variant="default" onClick={leaveCompany}>
        <ArrowLeftIcon />
        Volver a Empresas
      </Button>
    </Card>
  );
}

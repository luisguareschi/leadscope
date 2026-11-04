"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { ThemeMenuItems } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";

/** The account avatar at the top right of the header: who is signed in, the theme, and sign out. */
export function NavUser({
  email,
  label = "Operador",
}: {
  email: string;
  label?: string;
}) {
  const { signOut, email: sessionEmail } = useAuth();
  const router = useRouter();
  const shown = email || sessionEmail || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Cuenta: ${shown}`}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Avatar className="size-9">
          <AvatarFallback>{initials(shown)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar className="size-10">
              <AvatarFallback>{initials(shown)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-medium">{label}</span>
              <DropdownMenuLabel className="truncate px-0 py-0 font-normal">
                {shown}
              </DropdownMenuLabel>
            </div>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          <LogOutIcon />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

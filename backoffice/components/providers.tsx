"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { ThemeColorSync } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthProvider, useAuth } from "@/lib/auth";

const MOBILE_TOAST_TOP = "calc(0.75rem + env(safe-area-inset-top, 0px))";

/** On phones toasts drop from the top, clear of the notch, so they never cover the composer. */
function ResponsiveToaster() {
  const isMobile = useIsMobile();
  return (
    <Toaster
      richColors
      position={isMobile ? "top-center" : "bottom-right"}
      offset={isMobile ? { top: MOBILE_TOAST_TOP } : undefined}
      // Sonner switches to these below 600px wide.
      mobileOffset={{
        top: MOBILE_TOAST_TOP,
        left: "max(1rem, env(safe-area-inset-left, 0px))",
        right: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    />
  );
}

/** A new login must not keep the previous operator's panel data, including who is an admin. */
function AuthQueryCache() {
  const { email } = useAuth();
  const client = useQueryClient();
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (seen.current === undefined) {
      seen.current = email;
      return;
    }
    if (seen.current !== email) {
      seen.current = email;
      client.clear();
    }
  }, [email, client]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 2_000, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthQueryCache />
          <TooltipProvider>
            {children}
            <ResponsiveToaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

import { AppLogoTile } from "@/components/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** Sign-in pages, laid out like Revolut's SSO page: no card, a narrow form in the middle. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-card px-6 py-5 sm:px-8 dark:bg-transparent">
      <header className="flex items-center gap-2.5 font-heading text-lg font-semibold tracking-tight">
        <AppLogoTile className="size-8 rounded-[9px]" />
        LeadScope
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="flex w-full max-w-90 flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-[26px] leading-tight font-medium tracking-tight">
              {title}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="**:data-[slot=input]:h-12 **:data-[slot=input]:rounded-xl **:data-[slot=input]:px-4 **:data-[slot=input]:text-[15px]">
            {children}
          </div>
        </div>
      </main>
      <footer className="flex items-center gap-4 text-[13px] text-muted-foreground">
        <ThemeToggle className="-ml-2" />
        <span>Panel del asistente de WhatsApp</span>
      </footer>
    </div>
  );
}

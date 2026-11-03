import { AppLogo } from "@/components/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div className="relative flex min-h-svh items-center justify-center p-6">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex items-center gap-2.5 self-center font-heading text-2xl font-semibold tracking-tight">
          <AppLogo className="size-12" />
          LeadScope
        </div>
        <Card className="rounded-2xl [--card-spacing:--spacing(7)]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="[&_[data-slot=input]]:h-11">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

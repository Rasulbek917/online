"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardPathFor, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/types";

interface RequireAuthProps {
  children: ReactNode;
  roles?: Role[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = !roles || Boolean(user && roles.includes(user.role));

  useEffect(() => {
    if (loading || !user) return;
    if (!allowed) router.replace(dashboardPathFor(user.role));
  }, [allowed, loading, router, user]);

  useEffect(() => {
    if (loading || user) return;
    router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-bold">{t("errors.forbiddenTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("errors.forbiddenText")}</p>
        <Button asChild variant="gradient">
          <Link href={dashboardPathFor(user.role)}>{t("nav.dashboard")}</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

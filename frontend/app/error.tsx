"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { useI18n } from "@/lib/i18n";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-hero-glow" />
      <header className="container relative flex items-center justify-between py-5">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">{t("errors.serverTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("errors.serverText")}</p>
          {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">{error.digest}</p>}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button variant="gradient" onClick={reset}>
              <RefreshCw />
              {t("errors.retry")}
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <Home />
                {t("errors.goHome")}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

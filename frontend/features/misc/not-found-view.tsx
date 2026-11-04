"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { useI18n } from "@/lib/i18n";

export function NotFoundView() {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-hero-glow" />
      <header className="container relative flex items-center justify-between py-5">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <Home />
            {t("errors.goHome")}
          </Link>
        </Button>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-lg text-center">
          <p className="font-display text-7xl font-black tracking-tight gradient-text sm:text-8xl">404</p>
          <span className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">{t("errors.notFoundTitle")}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t("errors.notFoundText")}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gradient">
              <Link href="/">
                <Home />
                {t("errors.goHome")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/courses">
                <BookOpen />
                {t("nav.courses")}
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="relative border-t border-border/70">
        <div className="container flex items-center justify-between py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} IT PARK ACADEMY</span>
          <Link href="/courses" className="inline-flex items-center gap-1 hover:text-foreground">
            {t("home.ctaCourses")}
            <ArrowLeft className="h-3 w-3 rotate-180" />
          </Link>
        </div>
      </footer>
    </div>
  );
}

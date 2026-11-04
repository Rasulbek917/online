"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", key: "nav.home" },
  { href: "/courses", key: "nav.courses" },
  { href: "/categories", key: "nav.categories" },
  { href: "/about", key: "nav.about" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-hero-glow" />
      <header className="container relative flex items-center justify-between gap-3 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <Logo />
          <nav className="hidden items-center gap-0.5 md:flex" aria-label={t("nav.home")}>
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
                    active && "bg-secondary/60 text-foreground",
                  )}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.home")}</span>
            </Link>
          </Button>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <main className="relative flex flex-1 items-center py-6 sm:py-10">
        <div className="container">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div className="hidden lg:block">
              <Badge variant="default" className="mb-5">
                {t("home.badge")}
              </Badge>
              <h2 className="font-display text-4xl font-bold leading-[1.1] tracking-tight">
                {t("home.title1")}{" "}
                <span className="gradient-text">{t("home.title2")}</span>
              </h2>
              <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
                {t("home.subtitle")}
              </p>
              <ul className="mt-7 space-y-3">
                {[t("home.benefits.videoTitle"), t("home.benefits.quizTitle"), t("home.benefits.certTitle")].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="w-full max-w-md justify-self-center lg:justify-self-end">
              <div className="surface p-6 shadow-card sm:p-8">{children}</div>
              <p className="mt-5 text-center text-[11px] text-muted-foreground">
                © {new Date().getFullYear()} IT PARK ACADEMY. {t("footer.rights")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

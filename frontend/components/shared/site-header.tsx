"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeSwitcher } from "./theme-switcher";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationDropdown } from "./notification-dropdown";
import { UserMenu } from "./user-menu";

const links = [
  { href: "/", key: "nav.home" },
  { href: "/courses", key: "nav.courses" },
  { href: "/categories", key: "nav.categories" },
  { href: "/about", key: "nav.about" },
  { href: "/verify/certificate", key: "nav.certificate" },
];

export function SiteHeader() {
  const { t } = useI18n();
  const { user, loading, isTeacher, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/courses?search=${encodeURIComponent(query)}` : "/courses");
    setMobileOpen(false);
  };

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-3">
        <Logo />

        <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
          {links.slice(0, 4).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
                active(link.href) && "bg-secondary/60 text-foreground",
              )}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <form onSubmit={onSearch} className="relative ml-auto hidden w-full max-w-xs md:block lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("nav.searchPlaceholder")}
            className="h-9 rounded-full bg-secondary/60 pl-9 text-xs"
            aria-label={t("common.search")}
          />
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/verify/certificate" className="hidden sm:block">
            <Button variant="ghost" size="iconSm" aria-label={t("nav.certificate")}>
              <ShieldCheck className="h-4 w-4" />
            </Button>
          </Link>
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeSwitcher />
          <NotificationDropdown />

          {loading ? (
            <div className="skeleton h-8 w-24 rounded-full" />
          ) : user ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm" variant="gradient">
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </div>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="iconSm" className="lg:hidden" aria-label={t("nav.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[86%] max-w-sm flex-col gap-0 p-0">
              <SheetHeader className="border-b border-border px-5 py-4">
                <SheetTitle className="flex items-center justify-between">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <div className="px-5 py-4">
                <form onSubmit={onSearch} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("nav.searchPlaceholder")}
                    className="pl-9"
                  />
                </form>
              </div>
              <nav className="flex flex-col gap-1 px-3">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                      active(link.href) && "bg-secondary text-foreground",
                    )}
                  >
                    {t(link.key)}
                  </Link>
                ))}
                {user && (
                  <>
                    <Link
                      href={dashboardPathFor(user.role)}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {t("nav.dashboard")}
                    </Link>
                    {isTeacher && (
                      <Link
                        href="/teacher"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        {t("nav.teacher")}
                      </Link>
                    )}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        {t("nav.admin")}
                      </Link>
                    )}
                  </>
                )}
              </nav>
              <div className="mt-auto space-y-3 border-t border-border p-5">
                <div className="flex items-center justify-between">
                  <LanguageSwitcher />
                  <ThemeSwitcher />
                </div>
                {!user && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>
                        {t("nav.login")}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="gradient">
                      <Link href="/register" onClick={() => setMobileOpen(false)}>
                        {t("nav.register")}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Bell,
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Trophy,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeSwitcher } from "./theme-switcher";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationDropdown } from "./notification-dropdown";
import { UserMenu } from "./user-menu";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const learningItems: NavItem[] = [
    { href: "/dashboard", label: t("dashboard.overview"), icon: LayoutDashboard, exact: true },
    { href: "/dashboard/courses", label: t("dashboard.myCourses"), icon: BookOpen },
    { href: "/dashboard/certificates", label: t("dashboard.certificates"), icon: Award },
    { href: "/dashboard/leaderboard", label: t("dashboard.ranking"), icon: Trophy },
    { href: "/dashboard/payments", label: t("dashboard.payments"), icon: CreditCard },
  ];

  const accountItems: NavItem[] = [
    { href: "/dashboard/notifications", label: t("dashboard.notifications"), icon: Bell },
    { href: "/dashboard/profile", label: t("dashboard.profile"), icon: UserRound },
    { href: "/dashboard/settings", label: t("dashboard.settings"), icon: Settings },
  ];

  const portalItem =
    user?.role === "teacher"
      ? { href: "/teacher", label: t("nav.teacher"), icon: GraduationCap }
      : user?.role === "admin"
        ? { href: "/admin", label: t("nav.admin"), icon: ShieldCheck }
        : null;

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const renderNav = (items: NavItem[], onNavigate?: () => void) => (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground",
              isActive(item) && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="truncate">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const sidebarContent = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" onClick={onNavigate} className="px-1">
        <Logo />
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {portalItem ? (
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("dashboard.account")}
            </p>
            {renderNav([portalItem], onNavigate)}
          </div>
        ) : null}
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("dashboard.learning")}
          </p>
          {renderNav(learningItems, onNavigate)}
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("dashboard.account")}
          </p>
          {renderNav(accountItems, onNavigate)}
        </div>
      </nav>

      <div className="space-y-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {t("nav.home")}
        </Link>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">{t("brand")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-card/40 lg:block">
        {sidebarContent()}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="iconSm" className="lg:hidden" aria-label={t("nav.menu")}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[86%] max-w-xs p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("nav.menu")}</SheetTitle>
                </SheetHeader>
                {sidebarContent(() => setMobileOpen(false))}
              </SheetContent>
            </Sheet>

            <div className="lg:hidden">
              <Logo />
            </div>

            <div className="hidden items-center gap-1 text-sm text-muted-foreground lg:flex">
              <Link href="/courses" className="rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/60 hover:text-foreground">
                {t("nav.courses")}
              </Link>
              <Link href="/verify/certificate" className="rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/60 hover:text-foreground">
                {t("nav.certificate")}
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitcher className="hidden sm:inline-flex" />
              <ThemeSwitcher />
              <NotificationDropdown />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

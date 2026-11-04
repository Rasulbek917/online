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
  MessageSquare,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { NotificationDropdown } from "./notification-dropdown";
import { ThemeSwitcher } from "./theme-switcher";
import { UserMenu } from "./user-menu";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

export function PortalShell({ role, children }: { role: "teacher" | "admin"; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const base = role === "teacher" ? "/teacher" : "/admin";

  const navItems: NavItem[] =
    role === "teacher"
      ? [
          { href: "/teacher", label: t("teacher.dashboard"), icon: LayoutDashboard, exact: true },
          { href: "/teacher/courses", label: t("teacher.courses"), icon: BookOpen },
          { href: "/teacher/students", label: t("teacher.students"), icon: Users },
          { href: "/teacher/payments", label: t("teacher.payments"), icon: CreditCard },
          { href: "/teacher/discounts", label: t("teacher.discounts"), icon: Percent },
          { href: "/teacher/certificates", label: t("teacher.certificates"), icon: Award },
          { href: "/teacher/comments", label: t("teacher.comments"), icon: MessageSquare },
          { href: "/teacher/notifications", label: t("teacher.notifications"), icon: Bell },
        ]
      : [
          { href: "/admin", label: t("admin.overview"), icon: LayoutDashboard, exact: true },
          { href: "/admin/users", label: t("admin.users"), icon: Users },
          { href: "/admin/courses", label: t("admin.courses"), icon: BookOpen },
          { href: "/admin/payments", label: t("admin.payments"), icon: CreditCard },
          { href: "/admin/discounts", label: t("teacher.discounts"), icon: Percent },
          { href: "/admin/certificates", label: t("admin.certificates"), icon: Award },
          { href: "/admin/comments", label: t("admin.comments"), icon: MessageSquare },
          { href: "/admin/audit", label: t("admin.auditLogs"), icon: ScrollText },
          { href: "/admin/settings", label: t("admin.settings"), icon: Settings },
          { href: "/admin/notifications", label: t("teacher.notifications"), icon: Bell },
        ];

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const renderNav = (onNavigate?: () => void) => (
    <ul className="space-y-1">
      {navItems.map((item) => (
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
      <Logo href={base} className="px-1" onClick={onNavigate} />

      <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {role === "teacher" ? <GraduationCap className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {role === "teacher" ? t("roles.teacher") : t("roles.admin")}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {role === "teacher" ? t("teacher.subtitle") : t("admin.subtitle")}
        </p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {role === "teacher" ? t("teacherPanel") : t("adminPanel")}
          </p>
          {renderNav(onNavigate)}
        </div>
      </nav>

      <div className="space-y-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {t("portal.openSite")}
        </Link>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <GraduationCap className="h-4 w-4" />
          {t("portal.studentDashboard")}
        </Link>
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
                {t("portal.catalog")}
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

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

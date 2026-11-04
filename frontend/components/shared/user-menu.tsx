"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { UserAvatar } from "./user-avatar";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (!user) return null;
  const roleLabel = t(`roles.${user.role}`);

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    toast.success(t("auth.logoutSuccess"));
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 py-1 pl-1 pr-3 transition-colors hover:bg-secondary/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("profile.title")}
        >
          <UserAvatar name={user.full_name} src={user.avatar} className="h-7 w-7" />
          <span className="hidden max-w-[110px] truncate text-xs font-medium sm:block">
            {user.first_name || user.full_name}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case">
          <div className="flex items-center gap-3 py-1">
            <UserAvatar name={user.full_name} src={user.avatar} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{user.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-secondary/60 px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">{t("dashboard.points")}</span>
            <span className="font-semibold text-foreground">{formatNumber(user.points ?? 0)}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={dashboardPathFor(user.role)}>
            <LayoutDashboard /> {t("nav.dashboard")}
          </Link>
        </DropdownMenuItem>
        {user.role === "student" && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/courses">
                <BookOpen /> {t("nav.myLearning")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/certificates">
                <Award /> {t("dashboard.certificates")}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {user.role === "teacher" && (
          <DropdownMenuItem asChild>
            <Link href="/teacher">
              <GraduationCap /> {t("nav.teacher")}
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> {t("nav.admin")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <UserRound /> {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings /> {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut /> {t("nav.logout")}
        </DropdownMenuItem>
        <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground">
          {user.email} · {lang.toUpperCase()}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Bell, Check, Languages, Loader2, Monitor, Moon, Send, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn, getErrorMessage } from "@/lib/utils";
import type { Lang } from "@/lib/types";
import { PageHeading } from "./shared";

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const persist = useMutation({
    mutationFn: (body: { language?: Lang; theme?: "dark" | "light" | "system" }) =>
      apiRequest("/api/auth/me/", { method: "PATCH", body }),
    onSuccess: () => refreshUser(),
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const changeLanguage = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    persist.mutate(
      { language: next },
      { onSuccess: () => toast.success(t("settings.saved")) },
    );
  };

  const changeTheme = (next: "light" | "dark" | "system") => {
    setTheme(next);
    persist.mutate({ theme: next });
  };

  const themes = [
    { value: "light", label: t("profile.light"), icon: Sun },
    { value: "dark", label: t("profile.dark"), icon: Moon },
    { value: "system", label: t("profile.system"), icon: Monitor },
  ] as const;

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.account")}
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("settings.appearance")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("settings.themeHint")}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {themes.map((option) => {
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeTheme(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-xs font-medium transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                  )}
                  aria-pressed={active}
                >
                  <option.icon className="h-5 w-5" />
                  {option.label}
                  {active ? <Check className="h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("settings.language")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("settings.languageHint")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["uz", "ru"] as Lang[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeLanguage(value)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                  lang === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                )}
                aria-pressed={lang === value}
              >
                {value === "uz" ? "O'zbekcha" : "Русский"}
                {lang === value ? <Check className="h-4 w-4" /> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("settings.notifications")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("profile.telegramHint")}</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("profile.telegram")}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.telegramHint")}</p>
              </div>
              <Badge variant="muted">{t("common.optional")}</Badge>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/profile">
                <Send className="h-4 w-4" />
                {t("profile.connectTelegram")}
              </Link>
            </Button>
            <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("settings.notificationsHint")}
            </p>
          </div>
        </section>

        <section className="surface p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("dashboard.account")}</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              href="/dashboard/profile"
              className="rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/35 hover:bg-secondary/40"
            >
              <p className="text-sm font-medium">{t("profile.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("profile.subtitle")}</p>
            </Link>
            <Link
              href="/dashboard/notifications"
              className="rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/35 hover:bg-secondary/40"
            >
              <p className="text-sm font-medium">{t("notifications.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("notifications.emptyHint")}</p>
            </Link>
            <Link
              href="/dashboard/payments"
              className="rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/35 hover:bg-secondary/40"
            >
              <p className="text-sm font-medium">{t("payments.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("payments.subtitle")}</p>
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            {t("profile.email")}: {user?.email}
          </p>
        </section>
      </div>

      {persist.isPending ? (
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("common.saving")}
        </p>
      ) : null}
    </div>
  );
}

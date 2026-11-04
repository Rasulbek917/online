"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/api";
import { useNotifications, useUnreadCount, queryKeys } from "@/lib/queries";
import { cn, formatRelative } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

function notificationLink(notification: AppNotification) {
  const data = notification.data || {};
  const courseSlug = typeof data.course_slug === "string" ? data.course_slug : null;
  if (notification.type === "certificate_ready") return "/dashboard/certificates";
  if (notification.type === "payment_success" || notification.type === "payment_failed") return "/dashboard/payments";
  if (notification.type === "quiz_result" && courseSlug) return `/courses/${courseSlug}`;
  if (courseSlug) return `/courses/${courseSlug}`;
  return "/dashboard/notifications";
}

export function NotificationDropdown() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const notifications = useNotifications(8, isAuthenticated);
  const unread = useUnreadCount(isAuthenticated);

  const markAll = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all/", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unread });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/notifications/${id}/read/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unread });
    },
  });

  if (!isAuthenticated) return null;
  const count = unread.data?.count ?? 0;
  const items = notifications.data?.results ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className="relative" aria-label={t("notifications.title")}>
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{t("notifications.title")}</p>
            {count > 0 && (
              <p className="text-xs text-muted-foreground">
                {count} {t("notifications.unread")}
              </p>
            )}
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={(event) => {
                event.preventDefault();
                markAll.mutate();
              }}
              disabled={markAll.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">{t("notifications.empty")}</p>
            <p className="text-xs text-muted-foreground">{t("notifications.emptyHint")}</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {items.map((notification) => (
              <Link
                key={notification.id}
                href={notificationLink(notification)}
                onClick={() => {
                  if (!notification.is_read) markOne.mutate(notification.id);
                }}
                className={cn(
                  "flex gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-secondary/50",
                  !notification.is_read && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    notification.is_read ? "bg-muted-foreground/30" : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {lang === "ru" ? notification.title_ru : notification.title_uz}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {lang === "ru" ? notification.message_ru : notification.message_uz}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {formatRelative(notification.created_at, lang)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Link
          href="/dashboard/notifications"
          className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-secondary/50"
        >
          {t("notifications.viewAll")}
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

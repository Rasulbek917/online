"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bell,
  BookOpen,
  CheckCheck,
  CircleDollarSign,
  CreditCard,
  Info,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryKeys, useNotifications, useUnreadCount } from "@/lib/queries";
import { cn, formatRelative, getErrorMessage } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";
import { PageHeading } from "./shared";

const iconByType: Record<string, typeof Bell> = {
  payment_success: CircleDollarSign,
  payment_failed: CreditCard,
  course_purchase: CircleDollarSign,
  certificate_ready: Award,
  quiz_result: Target,
  new_lesson: BookOpen,
  new_course: Sparkles,
  discount: Sparkles,
  comment: MessageSquare,
  system: Info,
};

function notificationLink(notification: AppNotification) {
  const data = notification.data || {};
  const courseSlug = typeof data.course_slug === "string" ? data.course_slug : null;
  const lessonId = typeof data.lesson_id === "number" ? data.lesson_id : null;
  if (notification.type === "certificate_ready") return "/dashboard/certificates";
  if (notification.type === "payment_success" || notification.type === "payment_failed") return "/dashboard/payments";
  if (notification.type === "quiz_result" && courseSlug && lessonId) return `/learn/${courseSlug}/${lessonId}`;
  if (courseSlug) return `/courses/${courseSlug}`;
  return null;
}

export function NotificationsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const notifications = useNotifications(50);
  const unread = useUnreadCount();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    queryClient.invalidateQueries({ queryKey: queryKeys.unread });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  };

  const markAll = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all/", { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.allRead"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const markOne = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/notifications/${id}/read/`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const items = useMemo(() => {
    const list = notifications.data?.results ?? [];
    return filter === "unread" ? list.filter((item) => !item.is_read) : list;
  }, [filter, notifications.data]);

  if (notifications.isError) {
    return <ErrorState onRetry={() => notifications.refetch()} />;
  }

  const count = unread.data?.count ?? 0;

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.account")}
        title={t("notifications.title")}
        subtitle={t("notifications.emptyHint")}
        actions={
          count > 0 ? (
            <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="h-4 w-4" />
              {t("notifications.markAllRead")}
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="unread">
              {t("notifications.unread")}
              {count > 0 ? (
                <Badge variant="default" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">
          {items.length} {t("notifications.title").toLowerCase()}
        </span>
      </div>

      {notifications.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? t("notifications.empty") : t("notifications.empty")}
          description={t("notifications.emptyHint")}
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((notification) => {
            const Icon = iconByType[notification.type] ?? Bell;
            const href = notificationLink(notification);
            const content = (
              <div
                className={cn(
                  "surface flex items-start gap-3 p-4 transition-colors",
                  !notification.is_read && "border-primary/25 bg-primary/5",
                  href && "hover:border-primary/35 hover:bg-secondary/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    notification.is_read ? "bg-secondary text-muted-foreground" : "bg-primary/12 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {lang === "ru" ? notification.title_ru : notification.title_uz}
                    </p>
                    {!notification.is_read ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                    ) : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {lang === "ru" ? notification.message_ru : notification.message_uz}
                  </p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                    {formatRelative(notification.created_at, lang)}
                  </p>
                </div>
                {!notification.is_read ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-xs"
                    disabled={markOne.isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      markOne.mutate(notification.id);
                    }}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t("notifications.markRead")}
                  </Button>
                ) : null}
              </div>
            );

            return (
              <li key={notification.id}>
                {href ? (
                  <Link
                    href={href}
                    onClick={() => {
                      if (!notification.is_read) markOne.mutate(notification.id);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

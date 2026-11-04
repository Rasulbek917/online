"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";
import { useI18n } from "./i18n";
import type {
  AdminUser,
  AppNotification,
  AuditLog,
  Broadcast,
  Certificate,
  Comment,
  Discount,
  Paginated,
  Payment,
  QuizManage,
  SystemSettings,
} from "./types";

export interface PortalVideo {
  id: number;
  lesson: number;
  title: string;
  file: string | null;
  hls_url: string;
  quality: string;
  duration_seconds: number;
  is_primary: boolean;
  processing_status: string;
  size_bytes: number;
}

export interface PortalLesson {
  id: number;
  section: number;
  title_uz: string;
  title_ru: string;
  description_uz: string;
  description_ru: string;
  order: number;
  duration_seconds: number;
  is_free_preview: boolean;
}

export interface AdminSettings extends Omit<SystemSettings, "payment_providers"> {
  id?: number;
  created_at?: string;
  updated_at?: string;
  payment_providers?: { id: string; label: string; enabled: boolean }[];
}

export function useAdminSettings(enabled = true) {
  return useQuery({
    queryKey: ["portal", "settings"],
    queryFn: () => apiRequest<AdminSettings>("/api/settings/"),
    enabled,
  });
}

export function useTeachers(enabled = true) {
  return useQuery({
    queryKey: ["portal", "teachers"],
    queryFn: () =>
      apiRequest<Paginated<AdminUser>>("/api/users/", { query: { role: "teacher", page_size: 100 } }),
    enabled,
  });
}

export function usePortalPayments(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["portal", "payments", lang],
    queryFn: () => apiRequest<Paginated<Payment>>("/api/payments/", { lang, query: { page_size: 100 } }),
    enabled,
  });
}

export function usePortalCertificates(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["portal", "certificates", lang],
    queryFn: () => apiRequest<Paginated<Certificate>>("/api/certificates/", { lang, query: { page_size: 100 } }),
    enabled,
  });
}

export function usePortalComments(scope: "teacher" | "all", courseSlug?: string, enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["portal", "comments", scope, courseSlug || "", lang],
    queryFn: () =>
      apiRequest<Paginated<Comment>>("/api/comments/", {
        lang,
        query: {
          page_size: 100,
          include_deleted: "1",
          scope: scope === "teacher" ? "teacher" : undefined,
          course_slug: courseSlug || undefined,
        },
      }),
    enabled,
  });
}

export function useAuditLogs(enabled = true) {
  return useQuery({
    queryKey: ["portal", "audit"],
    queryFn: () => apiRequest<Paginated<AuditLog>>("/api/audit-logs/", { query: { page_size: 100 } }),
    enabled,
  });
}

export function useBroadcasts(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["portal", "broadcasts", lang],
    queryFn: () => apiRequest<Paginated<Broadcast>>("/api/notifications/broadcasts/", { lang, query: { page_size: 20 } }),
    enabled,
  });
}

export function usePortalDiscounts(enabled = true) {
  return useQuery({
    queryKey: ["portal", "discounts"],
    queryFn: () => apiRequest<Paginated<Discount>>("/api/discounts/", { query: { page_size: 100 } }),
    enabled,
  });
}

export function usePortalVideos(lessonId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["portal", "videos", lessonId],
    queryFn: () =>
      apiRequest<Paginated<PortalVideo>>("/api/videos/", { query: { lesson: lessonId ?? undefined, page_size: 50 } }),
    enabled: enabled && Boolean(lessonId),
  });
}

export function usePortalLesson(lessonId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["portal", "lesson", lessonId],
    queryFn: () => apiRequest<PortalLesson>(`/api/lessons/${lessonId}/`),
    enabled: enabled && Boolean(lessonId),
  });
}

export function usePortalQuiz(quizId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["portal", "quiz", quizId],
    queryFn: () => apiRequest<QuizManage>(`/api/quizzes/${quizId}/`),
    enabled: enabled && Boolean(quizId),
  });
}

export type PortalNotification = AppNotification;

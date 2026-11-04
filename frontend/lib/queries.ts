"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import type {
  AdminAnalytics,
  AdminUser,
  AppNotification,
  Category,
  Certificate,
  CertificateVerification,
  ContinueLearning,
  Course,
  CourseDetail,
  Enrollment,
  LeaderboardResponse,
  Paginated,
  Payment,
  PublicSettings,
  PublicStats,
  StudentDashboard,
  Subscription,
  TeacherAnalytics,
  Testimonial,
  User,
} from "./types";

export const queryKeys = {
  categories: ["categories"] as const,
  courses: ["courses"] as const,
  course: (slug: string) => ["course", slug] as const,
  featured: ["courses", "featured"] as const,
  stats: ["public-stats"] as const,
  settings: ["public-settings"] as const,
  testimonials: ["testimonials"] as const,
  enrollments: ["enrollments"] as const,
  dashboard: ["student-dashboard"] as const,
  notifications: ["notifications"] as const,
  unread: ["notifications", "unread"] as const,
  certificates: ["certificates"] as const,
  payments: ["payments"] as const,
  leaderboard: (type: string, period: string) => ["leaderboard", type, period] as const,
  teacherAnalytics: (range: string) => ["teacher-analytics", range] as const,
  adminAnalytics: (range: string) => ["admin-analytics", range] as const,
  adminUsers: ["admin-users"] as const,
  adminPayments: ["admin-payments"] as const,
  users: ["users"] as const,
};

export interface CourseQuery {
  category?: string;
  level?: string;
  ordering?: string;
  search?: string;
  free?: string;
  discounted?: string;
  price_min?: string;
  price_max?: string;
  page?: number;
  page_size?: number;
  status?: string;
}

export function useCategories() {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.categories, lang],
    queryFn: () => apiRequest<Paginated<Category>>("/api/categories/", { auth: false, lang, query: { page_size: 50 } }),
    staleTime: 5 * 60_000,
  });
}

export function useCourses(params: CourseQuery = {}, enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.courses, params, lang],
    queryFn: () =>
      apiRequest<Paginated<Course>>("/api/courses/", {
        auth: true,
        lang,
        query: { page_size: 12, ...params },
      }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useMyCourses(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["courses", "mine", lang],
    queryFn: () => apiRequest<Paginated<Course>>("/api/courses/mine/", { lang, query: { page_size: 50 } }),
    enabled,
  });
}

export function useFeaturedCourses() {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.featured, lang],
    queryFn: () => apiRequest<Course[]>("/api/courses/featured/", { auth: false, lang }),
    staleTime: 2 * 60_000,
  });
}

export function usePopularCourses() {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.courses, "popular", lang],
    queryFn: () => apiRequest<Course[]>("/api/courses/popular/", { auth: false, lang }),
    staleTime: 2 * 60_000,
  });
}

export function useCourse(slug: string, enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.course(slug), lang],
    queryFn: () => apiRequest<CourseDetail>(`/api/courses/${slug}/`, { lang }),
    enabled: Boolean(slug) && enabled,
  });
}

export function usePublicStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => apiRequest<PublicStats>("/api/stats/", { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiRequest<PublicSettings>("/api/settings/", { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useTestimonials() {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.testimonials, lang],
    queryFn: () => apiRequest<Testimonial[]>("/api/testimonials/", { auth: false, lang }),
    staleTime: 5 * 60_000,
  });
}

export function useEnrollments(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.enrollments, lang],
    queryFn: () => apiRequest<Paginated<Enrollment>>("/api/enrollments/", { lang, query: { page_size: 50 } }),
    enabled,
  });
}

export function useStudentDashboard(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.dashboard, lang],
    queryFn: () => apiRequest<StudentDashboard>("/api/analytics/dashboard/", { lang }),
    enabled,
  });
}

export function useContinueLearning(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["continue-learning", lang],
    queryFn: () => apiRequest<{ results: ContinueLearning[] }>("/api/progress/continue-learning/", { lang }),
    enabled,
  });
}

export function useSubscriptions(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["subscriptions", lang],
    queryFn: () => apiRequest<Paginated<Subscription>>("/api/subscriptions/", { lang, query: { page_size: 50 } }),
    enabled,
  });
}

export function useNotifications(limit = 20, enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.notifications, limit, lang],
    queryFn: () =>
      apiRequest<Paginated<AppNotification>>("/api/notifications/", { lang, query: { page_size: limit } }),
    enabled,
  });
}

export function useUnreadCount(enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.unread,
    queryFn: () => apiRequest<{ count: number }>("/api/notifications/unread-count/"),
    enabled: enabled && isAuthenticated,
    refetchInterval: 60_000,
  });
}

export function useCertificates(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.certificates, lang],
    queryFn: () => apiRequest<Paginated<Certificate>>("/api/certificates/", { lang, query: { page_size: 50 } }),
    enabled,
  });
}

export function usePayments(enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.payments, lang],
    queryFn: () => apiRequest<Paginated<Payment>>("/api/payments/", { lang, query: { page_size: 50 } }),
    enabled,
  });
}

export function useLeaderboard(type: string, period: string, enabled = true) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: [...queryKeys.leaderboard(type, period), lang],
    queryFn: () =>
      apiRequest<LeaderboardResponse>("/api/leaderboard/", { lang, query: { type, period } }),
    enabled,
  });
}

export function useVerifyCertificate(certificateId: string | null) {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ["verify-certificate", certificateId, lang],
    queryFn: () =>
      apiRequest<CertificateVerification>(`/api/certificates/verify/${certificateId}/`, { auth: false, lang }),
    enabled: Boolean(certificateId),
    retry: 0,
  });
}

export function useTeacherAnalytics(range = "30d", enabled = true) {
  return useQuery({
    queryKey: queryKeys.teacherAnalytics(range),
    queryFn: () => apiRequest<TeacherAnalytics>("/api/analytics/teacher/", { query: { range } }),
    enabled,
  });
}

export function useAdminAnalytics(range = "30d", enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminAnalytics(range),
    queryFn: () => apiRequest<AdminAnalytics>("/api/analytics/admin/", { query: { range } }),
    enabled,
  });
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: () => apiRequest<Paginated<AdminUser>>("/api/users/", { query: { page_size: 100 } }),
    enabled,
  });
}

export function useStudents(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.users, "students"],
    queryFn: () => apiRequest<Paginated<AdminUser>>("/api/users/students/", { query: { page_size: 100 } }),
    enabled,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<User>("/api/auth/me/"),
  });
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileQuestion,
  Globe2,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RatingStars } from "@/components/shared/rating-stars";
import { ErrorState } from "@/components/shared/error-state";
import { PaymentModal } from "@/features/checkout/payment-modal";
import { CommentSection } from "@/features/comments/comment-section";
import { apiRequest, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { queryKeys, useCourse } from "@/lib/queries";
import {
  cn,
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  getErrorMessage,
} from "@/lib/utils";
import type { CourseDetail, CourseSection, LessonSummary, Subscription } from "@/lib/types";

export function CourseDetailPage({ slug }: { slug: string }) {
  const { t, lang } = useI18n();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const courseQuery = useCourse(slug);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPeriod, setPaymentPeriod] = useState<"monthly" | "full">("monthly");

  const course = courseQuery.data;

  const invalidateAccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.course(slug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollments });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  };

  const start = useMutation({
    mutationFn: () =>
      apiRequest<{ course_slug: string; lesson_id: number }>(`/api/courses/${slug}/learn/`),
    onSuccess: (data) => router.push(`/learn/${data.course_slug}/${data.lesson_id}`),
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const enroll = useMutation({
    mutationFn: () => apiRequest(`/api/courses/${slug}/enroll/`, { method: "POST" }),
    onSuccess: () => {
      invalidateAccess();
      toast.success(t("toast.success"));
      start.mutate();
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const openPayment = (period: "monthly" | "full") => {
    setPaymentPeriod(period);
    setPaymentOpen(true);
  };

  const share = async () => {
    if (typeof window === "undefined" || !course) return;
    const url = window.location.href;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: course.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("course.linkCopied"));
      }
    } catch {
      // the user closed the native share sheet
    }
  };

  if (courseQuery.isLoading) return <CourseDetailSkeleton />;

  if (courseQuery.isError || !course) {
    return (
      <div className="container py-16">
        <ErrorState
          message={courseQuery.error ? getErrorMessage(courseQuery.error, t("errors.serverText")) : undefined}
          onRetry={() => courseQuery.refetch()}
        />
      </div>
    );
  }

  const thumbnail = mediaUrl(course.thumbnail);
  const teacher = course.teacher;
  const hasAccess = course.has_access;
  const quizCount = course.sections.reduce(
    (total, section) => total + section.lessons.filter((lesson) => lesson.quiz).length,
    0,
  );

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-hero-glow" />
      <div className="container relative py-6 lg:py-10">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary">
            {t("nav.home")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/courses" className="hover:text-primary">
            {t("nav.courses")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/categories/${course.category?.slug}`} className="hover:text-primary">
            {lang === "ru" ? course.category?.name_ru : course.category?.name_uz}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="max-w-[220px] truncate text-foreground/80">{course.title}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/20 via-secondary to-brand-2/15">
              {thumbnail ? (
                <Image
                  src={thumbnail}
                  alt={course.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 62vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen className="h-14 w-14 text-primary/40" />
                </div>
              )}
              <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-background/85 text-foreground backdrop-blur">
                    {lang === "ru" ? course.category?.name_ru : course.category?.name_uz}
                  </Badge>
                  <Badge variant="secondary" className="bg-background/85 text-foreground backdrop-blur">
                    {t(`levels.${course.level}`)}
                  </Badge>
                  {course.is_free && (
                    <Badge variant="success" className="bg-emerald-500 text-white">
                      {t("common.free")}
                    </Badge>
                  )}
                  {!course.is_free && course.discount_percent > 0 && (
                    <Badge variant="destructive" className="bg-destructive text-white">
                      -{course.discount_percent}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-balance font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                {course.title}
              </h1>
              {course.short_description && (
                <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {course.short_description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <RatingStars value={Number(course.rating_avg)} count={course.rating_count} />
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {t("course.studentsCount", { n: formatNumber(course.students_count) })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  {t("course.lessonsCount", { n: course.lessons_count })}
                </span>
                {course.duration_minutes > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {t("course.duration", { n: course.duration_minutes })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4" />
                  {course.language === "ru" ? "Русский" : "O'zbekcha"}
                </span>
                {course.published_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    {t("course.updated")}: {formatDate(course.published_at, lang)}
                  </span>
                )}
              </div>

              {teacher && (
                <div className="flex items-center gap-3">
                  <UserAvatar name={teacher.full_name} src={teacher.avatar} className="h-10 w-10" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t("course.instructor")}
                    </p>
                    <p className="text-sm font-semibold">{teacher.full_name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4 lg:row-span-2 lg:sticky lg:top-24">
            <div className="surface overflow-hidden">
              <div className="space-y-4 p-5">
                {course.is_free ? (
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-emerald-500">{t("common.free")}</p>
                    <p className="text-xs text-muted-foreground">{t("course.includesNote")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold tracking-tight">
                        {formatMoney(course.effective_price)}
                      </span>
                      {course.discount_percent > 0 && Number(course.old_price) > Number(course.effective_price) && (
                        <span className="pb-1 text-sm text-muted-foreground line-through">
                          {formatMoney(course.old_price)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("course.monthly")}: <span className="font-semibold text-foreground">{formatMoney(course.effective_monthly_price)}</span>
                      <span className="text-xs"> / {t("common.month")}</span>
                    </p>
                    {course.discount_percent > 0 && course.discount_ends_at && (
                      <DiscountCountdown target={course.discount_ends_at} />
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {!isAuthenticated ? (
                    <>
                      <Button asChild className="w-full" size="lg" variant="gradient">
                        <Link href={`/login?next=/courses/${course.slug}`}>
                          {course.is_free ? t("course.startFree") : t("nav.login")}
                        </Link>
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">{t("course.loginToBuy")}</p>
                    </>
                  ) : hasAccess ? (
                    <>
                      <Button
                        className="w-full"
                        size="lg"
                        variant="gradient"
                        onClick={() => start.mutate()}
                        disabled={start.isPending || enroll.isPending}
                      >
                        {start.isPending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                        {course.progress_percent > 0 ? t("course.continueFromLast") : t("course.startFromFirst")}
                      </Button>
                      {course.progress && course.progress.total_lessons > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("course.progress")}</span>
                            <span className="font-semibold">{course.progress.percent}%</span>
                          </div>
                          <Progress value={course.progress.percent} />
                          <p className="text-[11px] text-muted-foreground">
                            {course.progress.completed_lessons} / {course.progress.total_lessons} {t("common.lessons")}
                          </p>
                        </div>
                      )}
                      {course.subscription && <SubscriptionCard subscription={course.subscription} onRenew={() => openPayment("monthly")} />}
                    </>
                  ) : course.is_free ? (
                    <Button
                      className="w-full"
                      size="lg"
                      variant="gradient"
                      onClick={() => enroll.mutate()}
                      disabled={enroll.isPending}
                    >
                      {enroll.isPending ? <Loader2 className="animate-spin" /> : <GraduationCap />}
                      {t("course.startFree")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        size="lg"
                        variant="gradient"
                        onClick={() => openPayment("monthly")}
                      >
                        {t("course.subscribeMonthly")}
                        <span className="text-xs opacity-80">{formatMoney(course.effective_monthly_price)}</span>
                      </Button>
                      <Button className="w-full" size="lg" variant="outline" onClick={() => openPayment("full")}>
                        {t("course.payFull")}
                        <span className="text-xs opacity-70">{formatMoney(course.effective_price)}</span>
                      </Button>
                      {course.subscription && (
                        <SubscriptionCard subscription={course.subscription} onRenew={() => openPayment("monthly")} />
                      )}
                      <p className="text-center text-[11px] text-muted-foreground">{t("course.buyToAccess")}</p>
                    </>
                  )}
                </div>

                <ul className="space-y-2.5 border-t border-border/70 pt-4 text-sm">
                  <IncludeRow icon={Video} label={t("course.videoLessons")} value={course.lessons_count} />
                  {quizCount > 0 && <IncludeRow icon={FileQuestion} label={t("course.quizzes")} value={quizCount} />}
                  <IncludeRow icon={Layers} label={t("course.sectionsCount", { n: course.sections.length })} />
                  {course.duration_minutes > 0 && (
                    <IncludeRow icon={Clock} label={t("common.minutes")} value={course.duration_minutes} />
                  )}
                  <IncludeRow icon={Award} label={t("course.certificate")} />
                  <IncludeRow icon={ShieldCheck} label={t("course.lifetimeAccess")} />
                </ul>
              </div>

              <button
                type="button"
                onClick={share}
                className="flex w-full items-center justify-center gap-2 border-t border-border/70 bg-secondary/40 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Copy className="h-4 w-4" />
                {t("course.share")}
              </button>
            </div>

            {teacher && (
              <div className="surface p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("course.instructor")}
                </p>
                <div className="flex items-center gap-3">
                  <UserAvatar name={teacher.full_name} src={teacher.avatar} className="h-12 w-12" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{teacher.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {teacher.courses_count} {t("nav.courses").toLowerCase()} · {teacher.students_count} {t("common.students")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <div className="min-w-0">
            <Tabs defaultValue="about">
              <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="about">{t("course.about")}</TabsTrigger>
                <TabsTrigger value="curriculum">{t("course.curriculum")}</TabsTrigger>
                <TabsTrigger value="qa" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {t("course.reviews")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="space-y-6">
                <div className="surface p-5 sm:p-6">
                  <h2 className="font-display text-lg font-semibold">{t("course.about")}</h2>
                  <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                    {course.description || course.short_description || t("course.noDescription")}
                  </p>
                </div>

                <div className="surface p-5 sm:p-6">
                  <h2 className="font-display text-lg font-semibold">{t("course.includes")}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <IncludeTile icon={Video} title={`${course.lessons_count} ${t("course.videoLessons")}`} />
                    {quizCount > 0 && (
                      <IncludeTile icon={FileQuestion} title={`${quizCount} ${t("course.quizzes")}`} />
                    )}
                    <IncludeTile icon={Award} title={t("course.certificate")} />
                    <IncludeTile icon={ShieldCheck} title={t("course.lifetimeAccess")} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="curriculum">
                <div className="surface overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold">{t("course.curriculum")}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("course.sectionsCount", { n: course.sections.length })} · {course.lessons_count}{" "}
                        {t("common.lessons")}
                      </p>
                    </div>
                    <Badge variant="muted">
                      {formatDuration(course.duration_minutes * 60)}
                    </Badge>
                  </div>
                  {course.sections.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("course.noSections")}</p>
                  ) : (
                    <Curriculum course={course} hasAccess={hasAccess} isAuthenticated={isAuthenticated} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="qa">
                <div className="surface p-5 sm:p-6">
                  <CommentSection courseSlug={course.slug} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <PaymentModal
        course={course}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaultPeriod={paymentPeriod}
      />
    </div>
  );
}

function IncludeRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Video;
  label: string;
  value?: number;
}) {
  return (
    <li className="flex items-center gap-2.5 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1">{label}</span>
      {typeof value === "number" && <span className="font-medium text-foreground">{value}</span>}
    </li>
  );
}

function IncludeTile({ icon: Icon, title }: { icon: typeof Video; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

function SubscriptionCard({
  subscription,
  onRenew,
}: {
  subscription: Subscription;
  onRenew: () => void;
}) {
  const { t, lang } = useI18n();
  const label =
    subscription.status === "active"
      ? t("subscriptions.active")
      : subscription.status === "grace"
        ? t("subscriptions.grace")
        : t("subscriptions.expired");
  const variant = subscription.status === "active" ? "success" : subscription.status === "grace" ? "warning" : "destructive";

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t("nav.dashboard")}</span>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{t("subscriptions.accessUntil")}</span>
        <span className="font-medium">{formatDate(subscription.access_until, lang)}</span>
      </div>
      {subscription.status !== "expired" && (
        <p className="text-muted-foreground">{t("subscriptions.daysLeft", { n: subscription.days_remaining })}</p>
      )}
      {subscription.in_grace && <p className="text-amber-600 dark:text-amber-400">{t("subscriptions.graceNote")}</p>}
      {subscription.status !== "active" && (
        <Button size="sm" variant="outline" className="w-full" onClick={onRenew}>
          {t("subscriptions.renew")}
        </Button>
      )}
    </div>
  );
}

function Curriculum({
  course,
  hasAccess,
  isAuthenticated,
}: {
  course: CourseDetail;
  hasAccess: boolean;
  isAuthenticated: boolean;
}) {
  const { t } = useI18n();
  const defaultOpen = useMemo(() => course.sections.map((section) => String(section.id)), [course.sections]);

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="px-4 sm:px-5">
      {course.sections.map((section, index) => (
        <AccordionItem key={section.id} value={String(section.id)} className="last:border-b-0">
          <AccordionTrigger className="py-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
              <span className="truncate text-sm font-semibold">
                {index + 1}. {section.title}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {section.lessons_count} {t("common.lessons")}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-1.5">
            {section.lessons.map((lesson, lessonIndex) => (
              <LessonRow
                key={lesson.id}
                course={course}
                section={section}
                lesson={lesson}
                index={lessonIndex + 1}
                hasAccess={hasAccess}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function LessonRow({
  course,
  lesson,
  index,
  hasAccess,
  isAuthenticated,
}: {
  course: CourseDetail;
  section: CourseSection;
  lesson: LessonSummary;
  index: number;
  hasAccess: boolean;
  isAuthenticated: boolean;
}) {
  const { t } = useI18n();
  const preview = lesson.is_free_preview;
  const unlocked = preview || (hasAccess && !lesson.is_locked);
  const href = !isAuthenticated
    ? `/login?next=/courses/${course.slug}`
    : unlocked
      ? `/learn/${course.slug}/${lesson.id}`
      : null;

  const content = (
    <>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          lesson.is_completed
            ? "bg-emerald-500/15 text-emerald-500"
            : unlocked
              ? "bg-primary/10 text-primary"
              : "bg-secondary text-muted-foreground",
        )}
      >
        {lesson.is_completed ? <CheckCircle2 className="h-4 w-4" /> : String(index).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{lesson.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {lesson.has_video && (
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" />
              {formatDuration(lesson.duration_seconds)}
            </span>
          )}
          {lesson.quiz && (
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="h-3 w-3" />
              {lesson.quiz.total_questions} {t("learn.questions")}
            </span>
          )}
          {preview && <Badge variant="success" className="px-1.5 py-0 text-[9px]">{t("course.freePreview")}</Badge>}
          {lesson.is_completed && <Badge variant="success" className="px-1.5 py-0 text-[9px]">{t("common.completed")}</Badge>}
        </span>
      </span>
      {unlocked ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary/60"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 opacity-65">{content}</div>;
}

function DiscountCountdown({ target }: { target: string }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(target).getTime() - Date.now()),
  );

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const cells = [
    { value: days, label: t("course.dayShort") },
    { value: hours, label: t("time.hour") },
    { value: minutes, label: t("time.min") },
    { value: seconds, label: t("time.sec") },
  ];

  return (
    <div className="rounded-xl bg-destructive/5 p-2.5">
      <p className="mb-1.5 text-[11px] font-medium text-destructive">{t("course.discountEnds")}</p>
      <div className="flex gap-1.5">
        {cells.map((cell) => (
          <div key={cell.label} className="flex-1 rounded-lg bg-background/80 py-1 text-center">
            <p className="text-sm font-bold tabular-nums">{String(cell.value).padStart(2, "0")}</p>
            <p className="text-[9px] uppercase text-muted-foreground">{cell.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseDetailSkeleton() {
  return (
    <div className="container py-10">
      <div className="skeleton h-3 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="skeleton aspect-video w-full rounded-2xl" />
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-10 w-80 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

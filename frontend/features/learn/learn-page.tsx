"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  FileQuestion,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  Menu,
  MessageSquare,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { Logo } from "@/components/shared/logo";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { NotificationDropdown } from "@/components/shared/notification-dropdown";
import { UserMenu } from "@/components/shared/user-menu";
import { CommentSection } from "@/features/comments/comment-section";
import { apiRequest, ApiError, mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryKeys, useCourse } from "@/lib/queries";
import { cn, formatDuration, getErrorMessage } from "@/lib/utils";
import type { CourseDetail, LessonDetail } from "@/lib/types";
import { VideoPlayer } from "./video-player";
import { QuizPanel } from "./quiz-panel";

interface ProgressResponse {
  progress: { completed: boolean; watched_seconds: number; last_position: number };
  course_progress: { percent: number; is_complete: boolean; next_lesson_id: number | null };
}

export function LearnPage({ slug, lessonId }: { slug: string; lessonId: number }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const courseQuery = useCourse(slug);
  const [tab, setTab] = useState("lesson");
  const [quizKey, setQuizKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [coursePercent, setCoursePercent] = useState(0);
  const [mobileCurriculum, setMobileCurriculum] = useState(false);

  const lessonQuery = useQuery({
    queryKey: ["lesson", slug, lessonId, lang],
    queryFn: () => apiRequest<LessonDetail>(`/api/lessons/${lessonId}/student/`, { lang }),
    retry: false,
    enabled: Boolean(slug) && Boolean(lessonId),
  });

  const lesson = lessonQuery.data;
  const course = courseQuery.data;
  const accessDenied = lessonQuery.error instanceof ApiError && lessonQuery.error.status === 403;

  useEffect(() => {
    setTab("lesson");
    setCompleted(false);
    setQuizKey(0);
    setCoursePercent(course?.progress?.percent ?? 0);
  }, [lessonId, course?.progress?.percent]);

  useEffect(() => {
    if (lesson?.progress?.completed) setCompleted(true);
  }, [lesson?.progress?.completed]);

  const saveProgress = useMutation({
    mutationFn: ({
      position,
      duration,
      videoId,
      complete,
    }: {
      position: number;
      duration: number;
      videoId?: number;
      complete?: boolean;
    }) =>
      apiRequest<ProgressResponse>(`/api/lessons/${lessonId}/progress/`, {
        method: "POST",
        body: {
          lesson_id: lessonId,
          video_id: videoId,
          watched_seconds: Math.max(0, Math.round(position)),
          duration: Math.max(0, Math.round(duration)),
          completed: Boolean(complete),
        },
      }),
    onSuccess: (data, variables) => {
      setCoursePercent(data.course_progress.percent);
      if (data.progress.completed) setCompleted(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["continue-learning"] });
      if (data.progress.completed || variables.complete) {
        queryClient.invalidateQueries({ queryKey: queryKeys.course(slug) });
        queryClient.invalidateQueries({ queryKey: queryKeys.certificates });
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments });
        if (data.course_progress.is_complete) toast.success(t("learn.certificateIssued"));
      }
    },
  });

  const flatLessons = useMemo(
    () => course?.sections.flatMap((section) => section.lessons) ?? [],
    [course],
  );

  const currentIndex = flatLessons.findIndex((item) => item.id === lessonId);
  const previousLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 ? flatLessons[currentIndex + 1] : null;
  const videos = lesson?.videos ?? [];
  const primaryVideo = videos.find((video) => video.is_primary) || videos[0];
  const videoCompleted = completed || Boolean(lesson?.progress?.completed) || Boolean(lesson?.is_completed);
  const startPosition = videoCompleted ? 0 : lesson?.progress?.last_position || 0;

  const goToLesson = (id: number) => {
    router.push(`/learn/${slug}/${id}`);
  };

  const markComplete = () => {
    if (!lesson) return;
    const duration =
      lesson.progress?.duration || primaryVideo?.duration_seconds || lesson.duration_seconds || 0;
    saveProgress.mutate({
      position: duration,
      duration,
      videoId: primaryVideo?.id,
      complete: true,
    });
  };

  if (lessonQuery.isLoading || courseQuery.isLoading) {
    return <LearnSkeleton />;
  }

  if (accessDenied) {
    return (
      <div className="min-h-dvh bg-background">
        <LearnHeader slug={slug} title={course?.title} percent={coursePercent} onOpenCurriculum={() => setMobileCurriculum(true)} />
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="surface flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <Lock className="h-7 w-7" />
            </span>
            <h1 className="text-xl font-bold">{t("learn.locked")}</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("course.buyToAccess")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {previousLesson ? (
                <Button variant="outline" onClick={() => goToLesson(previousLesson.id)}>
                  <ChevronLeft className="h-4 w-4" />
                  {t("learn.prevLesson")}
                </Button>
              ) : null}
              <Button asChild variant="gradient">
                <Link href={`/courses/${slug}`}>{t("learn.backToCourse")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/dashboard">{t("learn.dashboard")}</Link>
              </Button>
            </div>
            {course ? (
              <div className="mt-6 w-full border-t border-border/70 pt-6 text-left">
                <Curriculum
                  course={course}
                  currentId={-1}
                  slug={slug}
                  percent={course.progress?.percent ?? 0}
                  onNavigate={goToLesson}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (lessonQuery.isError && !lesson) {
    return (
      <div className="min-h-dvh bg-background">
        <LearnHeader slug={slug} title={course?.title} percent={coursePercent} onOpenCurriculum={() => setMobileCurriculum(true)} />
        <div className="container max-w-3xl py-16">
          <ErrorState
            message={getErrorMessage(lessonQuery.error, t("errors.serverText"))}
            onRetry={() => lessonQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="container py-16">
        <ErrorState onRetry={() => lessonQuery.refetch()} />
      </div>
    );
  }

  const title = lang === "ru" ? lesson.title_ru : lesson.title_uz;
  const description = lesson.description;
  const nextUnlocked =
    Boolean(lesson.is_completed) ||
    Boolean(lesson.quiz?.passed) ||
    (videoCompleted && !lesson.quiz);

  return (
    <div className="min-h-dvh bg-background">
      <LearnHeader
        slug={slug}
        title={course.title}
        percent={coursePercent}
        onOpenCurriculum={() => setMobileCurriculum(true)}
      />

      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5 lg:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            {videos.length > 0 ? (
              <VideoPlayer
                key={`${lesson.id}-${lang}`}
                videos={videos}
                startPosition={startPosition}
                poster={mediaUrl(course.thumbnail)}
                title={title}
                onProgress={(position, duration, videoId) =>
                  saveProgress.mutate({ position, duration, videoId })
                }
                onEnded={(position, duration, videoId) =>
                  saveProgress.mutate({ position, duration, videoId, complete: true })
                }
                onRefresh={() => lessonQuery.refetch()}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/30 px-6 text-center">
                <PlayCircle className="h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">{t("learn.noVideo")}</p>
              </div>
            )}

            <section className="surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t("learn.lesson")} {lesson.order}
                </Badge>
                {lesson.is_free_preview ? <Badge variant="success">{t("course.freePreview")}</Badge> : null}
                {videoCompleted ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("learn.completed")}
                  </Badge>
                ) : null}
                {lesson.quiz ? (
                  <Badge variant={lesson.quiz.passed ? "success" : "muted"} className="gap-1">
                    <FileQuestion className="h-3 w-3" />
                    {lesson.quiz.passed ? t("learn.passed") : t("learn.quizTitle")}
                  </Badge>
                ) : null}
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {t("learn.autoSaved")}
                </span>
              </div>

              <h1 className="mt-2.5 text-xl font-bold leading-snug sm:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}

              <Separator className="my-4" />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!lesson.previous_lesson_id}
                  onClick={() => lesson.previous_lesson_id && goToLesson(lesson.previous_lesson_id)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("learn.prevLesson")}
                </Button>

                {!videoCompleted && videos.length > 0 ? (
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={markComplete}
                    disabled={saveProgress.isPending}
                  >
                    {saveProgress.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    {t("learn.markComplete")}
                  </Button>
                ) : null}

                {lesson.next_lesson_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={!nextUnlocked}
                    onClick={() => lesson.next_lesson_id && goToLesson(lesson.next_lesson_id)}
                  >
                    {t("learn.nextLesson")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              {!nextUnlocked ? (
                <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">{t("learn.nextLocked")}</p>
              ) : null}
            </section>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="lesson">
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  {t("course.about")}
                </TabsTrigger>
                <TabsTrigger value="quiz">
                  <FileQuestion className="mr-1.5 h-3.5 w-3.5" />
                  {t("learn.quizTitle")}
                </TabsTrigger>
                <TabsTrigger value="questions">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  {t("comments.title")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lesson" className="mt-4">
                <div className="surface space-y-4 p-5">
                  <h2 className="text-sm font-semibold">{t("course.about")}</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {description || t("course.noDescription")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 px-3 py-2.5 text-xs">
                      <span className="text-muted-foreground">{t("learn.courseProgress")}</span>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={coursePercent} className="h-1.5 flex-1" />
                        <span className="font-semibold">{coursePercent}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-xs">
                      <span className="text-muted-foreground">{t("learn.lessonDuration")}</span>
                      <span className="font-semibold">{formatDuration(lesson.duration_seconds)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="quiz" className="mt-4">
                {lesson.quiz ? (
                  <QuizPanel
                    key={`${lesson.quiz.id}-${quizKey}`}
                    quiz={lesson.quiz}
                    courseSlug={slug}
                    nextLessonId={lesson.next_lesson_id}
                    videoCompleted={videoCompleted}
                    onExit={() => setQuizKey((value) => value + 1)}
                    onNextLesson={goToLesson}
                  />
                ) : (
                  <div className="surface p-8 text-center text-sm text-muted-foreground">
                    {t("learn.noQuiz")}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="questions" className="mt-4">
                <div className="surface p-5">
                  <CommentSection courseSlug={slug} lessonId={lesson.id} />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-20">
              <Curriculum
                course={course}
                currentId={lessonId}
                slug={slug}
                percent={coursePercent}
                onNavigate={goToLesson}
              />
            </div>
          </aside>
        </div>
      </div>

      <Sheet open={mobileCurriculum} onOpenChange={setMobileCurriculum}>
        <SheetContent side="right" className="w-[92%] max-w-sm overflow-y-auto p-0 xl:hidden">
          <SheetHeader className="border-b border-border/70 px-4 py-3">
            <SheetTitle className="text-left text-sm">{t("learn.curriculum")}</SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <Curriculum
              course={course}
              currentId={lessonId}
              slug={slug}
              percent={coursePercent}
              onNavigate={(id) => {
                setMobileCurriculum(false);
                goToLesson(id);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LearnHeader({
  slug,
  title,
  percent,
  onOpenCurriculum,
}: {
  slug: string;
  title?: string;
  percent: number;
  onOpenCurriculum: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-2 px-3 sm:px-5">
        <Link href="/" className="hidden sm:block">
          <Logo />
        </Link>
        <Link href="/dashboard" className="sm:hidden">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </Link>

        <div className="mx-2 hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-xs font-medium">{title}</p>
          <div className="mt-1 flex items-center gap-2">
            <Progress value={percent} className="h-1 w-40" />
            <span className="text-[10px] text-muted-foreground">{percent}%</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={`/courses/${slug}`}>
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("learn.backToCourse")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden"
            onClick={onOpenCurriculum}
          >
            <Menu className="h-3.5 w-3.5" />
            {t("learn.curriculum")}
          </Button>
          <LanguageSwitcher className="hidden md:inline-flex" />
          <ThemeSwitcher />
          <NotificationDropdown />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function Curriculum({
  course,
  currentId,
  slug,
  percent,
  onNavigate,
}: {
  course: CourseDetail;
  currentId: number;
  slug: string;
  percent: number;
  onNavigate: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  const currentSection = course.sections.find((section) =>
    section.lessons.some((lesson) => lesson.id === currentId),
  );

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{t("learn.curriculum")}</p>
          <span className="text-xs font-medium text-primary">{percent}%</span>
        </div>
        <Progress value={percent} className="mt-2 h-1.5" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {course.progress?.completed_lessons ?? 0}/{course.progress?.total_lessons ?? 0} {t("common.lessons")}
        </p>
      </div>

      <Accordion
        type="multiple"
        defaultValue={currentSection ? [String(currentSection.id)] : course.sections[0] ? [String(course.sections[0].id)] : []}
        className="max-h-[calc(100dvh-220px)] overflow-y-auto px-2 py-2"
      >
        {course.sections.map((section) => (
          <AccordionItem key={section.id} value={String(section.id)} className="border-b-0">
            <AccordionTrigger className="px-2 py-2.5 text-left text-xs font-semibold hover:no-underline">
              <span className="line-clamp-2">{section.title}</span>
            </AccordionTrigger>
            <AccordionContent className="pb-1 pt-0">
              <ul className="space-y-0.5">
                {section.lessons.map((item) => {
                  const accessible = item.is_free_preview || (course.has_access && !item.is_locked);
                  const active = item.id === currentId;
                  const title = lang === "ru" ? item.title_ru : item.title_uz;
                  const content = (
                    <>
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                          item.is_completed
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : active
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {item.is_completed ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : accessible ? (
                          item.order
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-xs", active ? "font-semibold text-primary" : "")}>
                          {title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {formatDuration(item.duration_seconds)}
                          {item.has_video ? <PlayCircle className="h-2.5 w-2.5" /> : null}
                          {item.quiz ? <FileQuestion className="h-2.5 w-2.5" /> : null}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {accessible ? (
                        <button
                          type="button"
                          onClick={() => onNavigate(item.id)}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/60",
                            active && "bg-primary/8",
                          )}
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="flex w-full cursor-not-allowed items-start gap-2.5 rounded-lg px-2 py-2 opacity-60">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {course.certificate_id ? (
        <div className="border-t border-gold/25 bg-gold/5 p-3">
          <Link
            href={`/verify/certificate/${course.certificate_id}`}
            className="flex items-center gap-2 text-xs font-medium text-gold hover:opacity-80"
          >
            <Award className="h-4 w-4" />
            {t("dashboard.viewCertificate")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function LearnSkeleton() {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-background">
      <div className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center px-4">
          <Logo />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="skeleton aspect-video rounded-2xl" />
          <div className="surface space-y-3 p-5">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
        <div className="hidden xl:block">
          <div className="skeleton h-96 rounded-2xl" />
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("learn.playerLoading")}</p>
    </div>
  );
}

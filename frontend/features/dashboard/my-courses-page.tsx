"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Award, BookOpen, CheckCircle2, PlayCircle, Search, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useEnrollments, useSubscriptions } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import type { Enrollment } from "@/lib/types";
import { PageHeading } from "./shared";

type Filter = "all" | "in_progress" | "completed";

export function MyCoursesPage() {
  const { t, lang } = useI18n();
  const enrollments = useEnrollments();
  const subscriptions = useSubscriptions();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const subscriptionByCourse = useMemo(() => {
    const map = new Map<number, { status: string; days_remaining: number; access_until: string }>();
    subscriptions.data?.results.forEach((item) => {
      if (!map.has(item.course.id)) {
        map.set(item.course.id, {
          status: item.status,
          days_remaining: item.days_remaining,
          access_until: item.access_until,
        });
      }
    });
    return map;
  }, [subscriptions.data]);

  const items = useMemo(() => {
    let list = enrollments.data?.results ?? [];
    if (filter === "completed") list = list.filter((item) => Boolean(item.completed_at));
    if (filter === "in_progress") list = list.filter((item) => !item.completed_at);
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (item) =>
          item.course.title.toLowerCase().includes(query) ||
          item.course.title_uz.toLowerCase().includes(query) ||
          item.course.title_ru.toLowerCase().includes(query),
      );
    }
    return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [enrollments.data, filter, search]);

  if (enrollments.isError) {
    return <ErrorState onRetry={() => enrollments.refetch()} />;
  }

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.learning")}
        title={t("dashboard.myCourses")}
        subtitle={t("dashboard.coursesSubtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">
              <BookOpen className="h-4 w-4" />
              {t("dashboard.browseCourses")}
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="in_progress">{t("common.inProgress")}</TabsTrigger>
            <TabsTrigger value="completed">{t("common.completed")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("dashboard.searchMyCourses")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>
      </div>

      {enrollments.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="surface overflow-hidden">
              <div className="skeleton aspect-[16/9] rounded-none" />
              <div className="space-y-3 p-4">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-8 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("dashboard.noCourses")}
          description={t("dashboard.noCoursesHint")}
          actionLabel={t("dashboard.browseCourses")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((enrollment) => (
            <EnrollmentCard
              key={enrollment.id}
              enrollment={enrollment}
              subscription={subscriptionByCourse.get(enrollment.course.id)}
              lang={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EnrollmentCard({
  enrollment,
  subscription,
  lang,
}: {
  enrollment: Enrollment;
  subscription?: { status: string; days_remaining: number; access_until: string };
  lang: "uz" | "ru";
}) {
  const { t } = useI18n();
  const thumbnail = mediaUrl(enrollment.course.thumbnail);
  const completed = Boolean(enrollment.completed_at);
  const lessonId = enrollment.next_lesson_id ?? enrollment.last_lesson?.id;
  const learnHref = lessonId
    ? `/learn/${enrollment.course.slug}/${lessonId}`
    : `/courses/${enrollment.course.slug}`;
  const grace = subscription?.status === "grace";

  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <Link href={`/courses/${enrollment.course.slug}`} className="relative block aspect-[16/9] bg-gradient-to-br from-primary/15 via-secondary to-brand-2/10">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={enrollment.course.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary/40" />
          </span>
        )}
        <div className="absolute left-2.5 top-2.5">
          <Badge variant="secondary" className="bg-background/85 text-foreground backdrop-blur">
            {lang === "ru" ? enrollment.course.category?.name_ru : enrollment.course.category?.name_uz}
          </Badge>
        </div>
        {completed ? (
          <div className="absolute right-2.5 top-2.5">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("common.completed")}
            </Badge>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <Link
            href={`/courses/${enrollment.course.slug}`}
            className="line-clamp-2 font-display text-[15px] font-semibold leading-snug transition-colors hover:text-primary"
          >
            {enrollment.course.title}
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {enrollment.last_lesson
              ? `${t("dashboard.lastLesson")}: ${lang === "ru" ? enrollment.last_lesson.title_ru : enrollment.last_lesson.title_uz}`
              : t("common.notStarted")}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("course.progress")}</span>
            <span className="font-semibold">{enrollment.progress_percent}%</span>
          </div>
          <Progress value={enrollment.progress_percent} className="h-2" />
        </div>

        {subscription ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Timer className="h-3 w-3" />
            {subscription.status === "expired"
              ? t("dashboard.subscriptionEnded")
              : grace
                ? t("subscriptions.graceNote")
                : t("dashboard.daysLeft", { n: subscription.days_remaining })}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <Button asChild size="sm" variant={completed ? "outline" : "gradient"} className="flex-1">
            <Link href={learnHref}>
              <PlayCircle className="h-3.5 w-3.5" />
              {completed ? t("learn.watchAgain") : enrollment.progress_percent > 0 ? t("common.continue") : t("learn.startLesson")}
            </Link>
          </Button>
          {enrollment.certificate_id ? (
            <Button asChild size="sm" variant="gold">
              <Link href={`/verify/certificate/${enrollment.certificate_id}`}>
                <Award className="h-3.5 w-3.5" />
                {t("dashboard.viewCertificate")}
              </Link>
            </Button>
          ) : null}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t("dashboard.updatedLabel")}: {formatDate(enrollment.updated_at, lang)}
        </p>
      </div>
    </article>
  );
}

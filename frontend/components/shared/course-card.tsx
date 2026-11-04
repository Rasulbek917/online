"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Clock, Users, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Course } from "@/lib/types";
import { PriceDisplay } from "./price-display";
import { RatingStars } from "./rating-stars";

export function CourseCard({ course, className }: { course: Course; className?: string }) {
  const { t, lang } = useI18n();
  const thumbnail = mediaUrl(course.thumbnail);
  const title = course.title || (lang === "ru" ? course.title_ru : course.title_uz);
  const teacherName = course.teacher?.full_name;
  const hasDiscount = course.discount_percent > 0;
  const enrolled = course.is_enrolled;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group surface surface-hover flex h-full flex-col overflow-hidden",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/15 via-secondary to-brand-2/10">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <Badge variant="secondary" className="bg-background/85 text-foreground backdrop-blur">
            {lang === "ru" ? course.category?.name_ru : course.category?.name_uz}
          </Badge>
          <div className="flex flex-col items-end gap-1.5">
            {course.is_free ? (
              <Badge variant="success" className="bg-emerald-500 text-white">
                {t("common.free")}
              </Badge>
            ) : hasDiscount ? (
              <Badge variant="destructive" className="bg-destructive text-white">
                -{course.discount_percent}%
              </Badge>
            ) : null}
          </div>
        </div>
        {course.duration_minutes > 0 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Clock className="h-3 w-3" />
            {formatDurationShort(course.duration_minutes, t)}
          </span>
        )}
        {course.is_enrolled && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-slate-900">
              <PlayCircle className="h-4 w-4" />
              {t("common.continueLearning")}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 min-h-[2.6rem] font-display text-[15px] font-semibold leading-snug transition-colors group-hover:text-primary">
            {title}
          </h3>
          {teacherName ? (
            <p className="truncate text-xs text-muted-foreground">{teacherName}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <RatingStars value={Number(course.rating_avg)} count={course.rating_count} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {course.students_count}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/70 pt-3">
          <PriceDisplay
            price={course.effective_price}
            oldPrice={hasDiscount ? course.old_price : null}
            monthly={course.effective_monthly_price}
            discountPercent={course.discount_percent}
            free={course.is_free}
            size="sm"
          />
          <span className="text-xs text-muted-foreground">
            {course.lessons_count} {t("common.lessons")}
          </span>
        </div>

        {enrolled && course.progress_percent > 0 ? (
          <div className="space-y-1">
            <Progress value={course.progress_percent} className="h-1.5" />
            <p className="text-right text-[11px] text-muted-foreground">{course.progress_percent}%</p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function formatDurationShort(minutes: number, t: (key: string) => string) {
  if (minutes < 60) return `${minutes} ${t("common.minutes")}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? `${hours} ${t("common.hours")} ${rest} ${t("common.minutes")}`
    : `${hours} ${t("common.hours")}`;
}

export function CourseCardSkeleton() {
  return (
    <div className="surface animate-pulse overflow-hidden">
      <div className="skeleton aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-2/5" />
        <div className="skeleton h-3 w-3/5" />
        <div className="skeleton h-6 w-1/2" />
      </div>
    </div>
  );
}

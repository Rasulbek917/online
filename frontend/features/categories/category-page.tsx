"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { CourseGrid } from "@/components/shared/course-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useCategories, useCourses } from "@/lib/queries";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CategoryPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const categories = useCategories();
  const [ordering, setOrdering] = useState("popular");
  const [page, setPage] = useState(1);

  const category = categories.data?.results.find((item) => item.slug === slug);
  const query = useMemo(
    () => ({ category: slug, ordering, page }),
    [slug, ordering, page],
  );
  const courses = useCourses(query, Boolean(slug));

  return (
    <div className="container py-10 lg:py-14">
      <Button asChild variant="ghost" size="sm" className="mb-6 gap-1.5 text-muted-foreground">
        <Link href="/categories">
          <ArrowLeft className="h-4 w-4" /> {t("nav.categories")}
        </Link>
      </Button>

      <div className="surface relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("nav.categories")}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              {category ? (lang === "ru" ? category.name_ru : category.name_uz) : slug}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {category
                ? lang === "ru"
                  ? category.description_ru
                  : category.description_uz
                : t("courses.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-secondary px-3 py-2 text-sm">
              <span className="font-semibold">{courses.data?.count ?? 0}</span>{" "}
              <span className="text-muted-foreground">{t("common.lessons")}</span>
            </span>
            <div className="w-[170px]">
              <Select
                value={ordering}
                onValueChange={(value) => {
                  setOrdering(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">{t("courses.sortPopular")}</SelectItem>
                  <SelectItem value="newest">{t("courses.sortNewest")}</SelectItem>
                  <SelectItem value="rating">{t("courses.sortRating")}</SelectItem>
                  <SelectItem value="price_low">{t("courses.sortPriceLow")}</SelectItem>
                  <SelectItem value="price_high">{t("courses.sortPriceHigh")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {courses.isError ? (
          <ErrorState message={courses.error.message} onRetry={() => courses.refetch()} />
        ) : !courses.isLoading && courses.data?.results.length === 0 ? (
          <EmptyState icon={BookOpen} title={t("courses.notFound")} description={t("courses.notFoundHint")} />
        ) : (
          <CourseGrid courses={courses.data?.results} loading={courses.isLoading} skeletonCount={6} />
        )}
        <Pagination
          page={page}
          totalPages={courses.data?.total_pages ?? 1}
          onChange={setPage}
          className="mt-10"
        />
      </div>
    </div>
  );
}

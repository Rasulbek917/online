"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Pagination } from "@/components/ui/pagination";
import { CourseGrid } from "@/components/shared/course-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useI18n } from "@/lib/i18n";
import { useCategories, useCourses } from "@/lib/queries";
import { cn } from "@/lib/utils";

const levelOptions = ["beginner", "intermediate", "advanced"] as const;
const sortOptions = ["popular", "newest", "rating", "price_low", "price_high"] as const;

export function CoursesPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const categories = useCategories();

  const [search, setSearch] = useState(params.get("search") || "");
  const [priceMin, setPriceMin] = useState(params.get("price_min") || "");
  const [priceMax, setPriceMax] = useState(params.get("price_max") || "");
  const [mobileFilters, setMobileFilters] = useState(false);

  const query = useMemo(
    () => ({
      search: params.get("search") || undefined,
      category: params.get("category") || undefined,
      level: params.get("level") || undefined,
      ordering: params.get("ordering") || undefined,
      free: params.get("free") || undefined,
      discounted: params.get("discounted") || undefined,
      price_min: params.get("price_min") || undefined,
      price_max: params.get("price_max") || undefined,
      page: Number(params.get("page") || 1),
    }),
    [params],
  );

  const courses = useCourses(query);

  useEffect(() => {
    const current = params.get("search") || "";
    if (search === current) return;
    const timer = setTimeout(() => updateParam("search", search || null), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`/courses?${next.toString()}`, { scroll: false });
  }

  function updatePrice() {
    const next = new URLSearchParams(params.toString());
    if (priceMin) next.set("price_min", priceMin);
    else next.delete("price_min");
    if (priceMax) next.set("price_max", priceMax);
    else next.delete("price_max");
    next.delete("page");
    router.replace(`/courses?${next.toString()}`, { scroll: false });
  }

  function clearFilters() {
    setSearch("");
    setPriceMin("");
    setPriceMax("");
    router.replace("/courses", { scroll: false });
  }

  const activeFilters = [
    query.category
      ? {
          key: "category",
          label:
            categories.data?.results.find((item) => item.slug === query.category)?.[
              lang === "ru" ? "name_ru" : "name_uz"
            ] || query.category,
        }
      : null,
    query.level ? { key: "level", label: t(`levels.${query.level}`) } : null,
    query.free ? { key: "free", label: t("courses.freeOnly") } : null,
    query.discounted ? { key: "discounted", label: t("courses.discountedOnly") } : null,
    query.price_min || query.price_max
      ? { key: "price", label: `${query.price_min || 0} – ${query.price_max || "∞"} so'm` }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const totalPages = courses.data?.total_pages ?? 1;
  const foundLabel = t("courses.found", { n: courses.data?.count ?? 0 });

  const filtersPanel = (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("courses.category")}
        </p>
        <div className="space-y-1">
          <button
            onClick={() => updateParam("category", null)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
              !query.category && "bg-secondary font-medium",
            )}
          >
            {t("common.all")}
          </button>
          {categories.data?.results.map((category) => (
            <button
              key={category.id}
              onClick={() => updateParam("category", category.slug)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                query.category === category.slug && "bg-secondary font-medium",
              )}
            >
              <span className="truncate">{lang === "ru" ? category.name_ru : category.name_uz}</span>
              <span className="text-[11px] text-muted-foreground">{category.course_count}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("courses.level")}
        </p>
        <div className="flex flex-wrap gap-2">
          {levelOptions.map((level) => (
            <button
              key={level}
              onClick={() => updateParam("level", query.level === level ? null : level)}
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-primary/40",
                query.level === level && "border-primary bg-primary/10 text-primary",
              )}
            >
              {t(`levels.${level}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("courses.priceRange")}
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={t("courses.minPrice")}
            value={priceMin}
            onChange={(event) => setPriceMin(event.target.value)}
            className="h-9 text-xs"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder={t("courses.maxPrice")}
            value={priceMax}
            onChange={(event) => setPriceMax(event.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="mt-2.5 w-full" onClick={updatePrice}>
          {t("common.apply")}
        </Button>
      </div>

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={query.free === "1"}
            onCheckedChange={(checked) => updateParam("free", checked ? "1" : null)}
          />
          {t("courses.freeOnly")}
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={query.discounted === "1"}
            onCheckedChange={(checked) => updateParam("discounted", checked ? "1" : null)}
          />
          {t("courses.discountedOnly")}
        </label>
      </div>

      <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
        {t("courses.resetFilters")}
      </Button>
    </div>
  );

  return (
    <div className="container py-10 lg:py-14">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("courses.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("courses.subtitle")}</p>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            updateParam("search", search || null);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("courses.searchPlaceholder")}
            className="h-11 rounded-xl pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("common.reset")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2">
          <div className="hidden w-[190px] sm:block">
            <Select
              value={query.ordering || "popular"}
              onValueChange={(value) => updateParam("ordering", value === "popular" ? null : value)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("courses.sort")} />
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
          <Sheet open={mobileFilters} onOpenChange={setMobileFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" />
                {t("common.filters")}
                {activeFilters.length > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px]">{activeFilters.length}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88%] max-w-sm overflow-y-auto">
              <SheetHeader className="mb-5">
                <SheetTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" /> {t("common.filters")}
                </SheetTitle>
              </SheetHeader>
              {filtersPanel}
              <Button className="mt-5 w-full" onClick={() => setMobileFilters(false)}>
                {t("common.apply")}
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="surface sticky top-24 p-5">{filtersPanel}</div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {courses.isLoading ? t("common.loading") : foundLabel}
            </p>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => {
                      if (filter.key === "price") {
                        setPriceMin("");
                        setPriceMax("");
                        const next = new URLSearchParams(params.toString());
                        next.delete("price_min");
                        next.delete("price_max");
                        router.replace(`/courses?${next.toString()}`, { scroll: false });
                      } else {
                        updateParam(filter.key, null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
                  >
                    {filter.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {courses.isError ? (
            <ErrorState message={courses.error.message} onRetry={() => courses.refetch()} />
          ) : !courses.isLoading && courses.data?.results.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t("courses.notFound")}
              description={t("courses.notFoundHint")}
              actionLabel={t("courses.clearFilters")}
              onAction={clearFilters}
            />
          ) : (
            <CourseGrid courses={courses.data?.results} loading={courses.isLoading} skeletonCount={6} />
          )}

          <Pagination
            page={query.page}
            totalPages={totalPages}
            onChange={(page) => updateParam("page", String(page))}
            className="mt-10"
          />
        </div>
      </div>
    </div>
  );
}

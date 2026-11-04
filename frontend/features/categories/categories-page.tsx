"use client";

import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Code2,
  FileCode2,
  GraduationCap,
  LayoutTemplate,
  Megaphone,
  Palette,
  PenTool,
  Server,
  Smartphone,
} from "lucide-react";
import { useCategories } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import type { Category } from "@/lib/types";

const iconMap: Record<string, typeof Code2> = {
  dasturlash: Code2,
  programming: Code2,
  python: Braces,
  javascript: FileCode2,
  frontend: LayoutTemplate,
  backend: Server,
  "ui-ux": PenTool,
  "grafik-dizayn": Palette,
  design: Palette,
  marketing: Megaphone,
  "mobil-dasturlash": Smartphone,
  mobile: Smartphone,
};

function iconFor(category: Category) {
  const key = category.slug?.toLowerCase() || "";
  const match = Object.keys(iconMap).find((candidate) => key.includes(candidate));
  return match ? iconMap[match] : GraduationCap;
}

export function CategoriesPage() {
  const { t, lang } = useI18n();
  const categories = useCategories();

  return (
    <div className="container py-10 lg:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("nav.categories")}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("home.categoriesTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("home.categoriesSubtitle")}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.isLoading
          ? Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="surface h-40 animate-pulse" />
            ))
          : categories.data?.results.map((category) => {
              const Icon = iconFor(category);
              const name = lang === "ru" ? category.name_ru : category.name_uz;
              const description = lang === "ru" ? category.description_ru : category.description_uz;
              return (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group surface surface-hover flex flex-col p-6"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-brand-2/10 text-primary transition-colors group-hover:from-primary group-hover:to-brand-2 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {category.course_count} {t("common.lessons")}
                    </span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">{name}</h2>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {description || t("home.categoriesSubtitle")}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

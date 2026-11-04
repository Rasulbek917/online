"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BookOpen,
  Braces,
  CheckCircle2,
  Code2,
  CreditCard,
  FileCode2,
  GraduationCap,
  Languages,
  LayoutTemplate,
  ListChecks,
  Megaphone,
  Moon,
  Palette,
  PenTool,
  Play,
  Quote,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CourseGrid } from "@/components/shared/course-grid";
import { CourseCardSkeleton } from "@/components/shared/course-card";
import { RatingStars } from "@/components/shared/rating-stars";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useI18n } from "@/lib/i18n";
import { useCategories, usePopularCourses, usePublicStats, useTestimonials } from "@/lib/queries";
import { mediaUrl } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";
import type { Category, Testimonial } from "@/lib/types";

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

function categoryIcon(category: Category) {
  const key = category.slug?.toLowerCase() || "";
  const match = Object.keys(iconMap).find((candidate) => key.includes(candidate));
  return match ? iconMap[match] : GraduationCap;
}

const benefits = [
  { icon: Video, title: "home.benefits.videoTitle", text: "home.benefits.videoText" },
  { icon: ListChecks, title: "home.benefits.quizTitle", text: "home.benefits.quizText" },
  { icon: Award, title: "home.benefits.certTitle", text: "home.benefits.certText" },
  { icon: CreditCard, title: "home.benefits.accessTitle", text: "home.benefits.accessText" },
  { icon: Send, title: "home.benefits.telegramTitle", text: "home.benefits.telegramText" },
  { icon: Languages, title: "home.benefits.themeTitle", text: "home.benefits.themeText" },
];

export function HomePage() {
  const { t, lang } = useI18n();
  const stats = usePublicStats();
  const categories = useCategories();
  const courses = usePopularCourses();
  const testimonials = useTestimonials();

  const heroCourse = courses.data?.[0];
  const heroTitle = heroCourse ? (lang === "ru" ? heroCourse.title_ru : heroCourse.title_uz) : "";

  const statItems = [
    { label: t("home.trustStudents"), value: stats.data?.students, icon: Users },
    { label: t("home.trustCourses"), value: stats.data?.courses, icon: BookOpen },
    { label: t("home.trustLessons"), value: stats.data?.lessons, icon: Play },
    { label: t("home.trustCertificates"), value: stats.data?.certificates, icon: Award },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative pb-16 pt-14 sm:pt-20 lg:pb-24 lg:pt-24">
        <div className="hero-grid absolute inset-0 -z-10" aria-hidden />
        <div className="absolute -left-32 top-10 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-[100px]" aria-hidden />
        <div className="absolute -right-24 top-40 -z-10 h-80 w-80 rounded-full bg-brand-2/20 blur-[110px]" aria-hidden />

        <div className="container grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="animate-fade-up">
            <Badge variant="outline" className="mb-5 gap-1.5 border-primary/30 bg-primary/5 px-3 py-1.5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.badge")}
            </Badge>
            <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              {t("home.title1")}{" "}
              <span className="gradient-text">{t("home.title2")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("home.subtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="gradient" className="group">
                <Link href="/courses">
                  {t("home.ctaCourses")}
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register">{t("home.ctaStart")}</Link>
              </Button>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {statItems.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center gap-1.5 text-2xl font-bold tracking-tight">
                    {stats.isLoading ? (
                      <span className="skeleton inline-block h-7 w-12" />
                    ) : (
                      formatNumber(item.value ?? 0)
                    )}
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/70">{t("home.statsNote")}</p>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-primary/20 blur-3xl" aria-hidden />
            <div className="ring-glow relative rounded-[1.75rem] border border-border/80 bg-card/90 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-primary/25 via-secondary to-brand-2/20">
                {heroCourse?.thumbnail ? (
                  <Image
                    src={mediaUrl(heroCourse.thumbnail) || ""}
                    alt={heroTitle}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-primary/70">
                    <GraduationCap className="h-14 w-14" />
                    <p className="text-sm font-medium">{t("brand")}</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                    {heroCourse ? heroCourse.category?.name_uz : t("home.featuredTitle")}
                  </p>
                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {heroTitle || t("home.featuredSubtitle")}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {heroCourse?.teacher?.full_name || t("home.whyTitle")}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {heroCourse ? (
                      <>
                        <RatingStars value={Number(heroCourse.rating_avg)} />
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {heroCourse.lessons_count}
                        </span>
                      </>
                    ) : (
                      <span>{t("home.benefits.videoTitle")}</span>
                    )}
                  </div>
                </div>
                {heroCourse ? (
                  <Badge
                    variant={
                      heroCourse.is_free
                        ? "success"
                        : heroCourse.discount_percent > 0
                          ? "default"
                          : "secondary"
                    }
                  >
                    {heroCourse.is_free
                      ? t("common.free")
                      : heroCourse.discount_percent > 0
                        ? t("course.discountBadge", { n: heroCourse.discount_percent })
                        : t("common.popular")}
                  </Badge>
                ) : (
                  <Badge>{t("common.popular")}</Badge>
                )}
              </div>

              <div className="mt-4 space-y-2 rounded-xl bg-secondary/60 p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{t("dashboard.progress")}</span>
                  <span className="font-medium text-foreground">{heroCourse?.progress_percent ?? 0}%</span>
                </div>
                <Progress value={heroCourse?.progress_percent ?? 0} className="h-1.5" />
              </div>
            </div>

            <div className="absolute -left-4 top-10 hidden items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium">{t("home.benefits.quizTitle")}</span>
            </div>
            <div className="absolute -right-3 bottom-16 hidden items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Award className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium">{t("course.certificate")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-14 lg:py-20">
        <div className="container">
          <SectionHeading
            eyebrow={t("nav.categories")}
            title={t("home.categoriesTitle")}
            description={t("home.categoriesSubtitle")}
            href="/categories"
          />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {categories.isLoading
              ? Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="surface h-32 animate-pulse" />
                ))
              : categories.data?.results.slice(0, 10).map((category) => {
                  const Icon = categoryIcon(category);
                  return (
                    <Link
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      className="group surface surface-hover flex flex-col justify-between gap-4 p-4"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {lang === "ru" ? category.name_ru : category.name_uz}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {category.course_count} {t("common.lessons")}
                        </p>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </div>
      </section>

      {/* Popular courses */}
      <section className="bg-secondary/30 py-14 lg:py-20">
        <div className="container">
          <SectionHeading
            eyebrow={t("common.popular")}
            title={t("home.featuredTitle")}
            description={t("home.featuredSubtitle")}
            href="/courses?ordering=popular"
          />
          <div className="mt-8">
            {courses.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <CourseCardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <CourseGrid courses={courses.data?.slice(0, 6)} />
            )}
            <div className="mt-8 text-center">
              <Button asChild variant="outline" className="group">
                <Link href="/courses">
                  {t("common.viewAll")}
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-14 lg:py-20">
        <div className="container">
          <SectionHeading
            eyebrow={t("home.whyTitle")}
            title={t("home.whyTitle")}
            description={t("home.whySubtitle")}
            center
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="surface group p-6 transition-colors hover:border-primary/30">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-brand-2/10 text-primary">
                  <benefit.icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold">{t(benefit.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(benefit.text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.data && testimonials.data.length > 0 && (
        <section className="bg-secondary/30 py-14 lg:py-20">
          <div className="container">
            <SectionHeading
              eyebrow={t("home.testimonialsTitle")}
              title={t("home.testimonialsTitle")}
              description={t("home.testimonialsSubtitle")}
              center
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.data.slice(0, 6).map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Certificate verify */}
      <section className="py-14 lg:py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card to-card p-6 sm:p-10 lg:p-14">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <Badge variant="gold" className="mb-4 gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("certificates.verifiedBadge")}
                </Badge>
                <h2 className="text-balance text-2xl font-bold sm:text-3xl">{t("home.certificateTitle")}</h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {t("home.certificateSubtitle")}
                </p>
                <div className="mt-6">
                  <Button asChild variant="gold" size="lg">
                    <Link href="/verify/certificate">
                      <ShieldCheck /> {t("home.certificateCta")}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-sm">
                <div className="rotate-[-2deg] rounded-2xl border border-gold/30 bg-gradient-to-br from-white to-amber-50 p-5 text-slate-900 shadow-2xl transition-transform hover:rotate-0 dark:from-slate-100 dark:to-amber-100">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-2 text-white">
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-bold tracking-widest">IT PARK ACADEMY</p>
                        <p className="text-[8px] uppercase tracking-wider text-slate-500">
                          {t("certificates.sampleOfCompletion")}
                        </p>
                      </div>
                    </div>
                    <Award className="h-7 w-7 text-amber-500" />
                  </div>
                  <p className="mt-5 text-[9px] uppercase tracking-widest text-slate-500">
                    {t("certificates.sampleIssuedFor")}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">{t("certificates.sampleName")}</p>
                  <p className="mt-2 text-[10px] text-slate-600">
                    {t("certificates.sampleCourseLine")}
                  </p>
                  <div className="mt-5 flex items-end justify-between">
                    <div className="text-[9px] text-slate-500">
                      <p>{t("certificates.sampleId")}</p>
                      <p className="mt-0.5">{t("certificates.sampleDate")}</p>
                    </div>
                    <div className="grid h-12 w-12 grid-cols-3 gap-0.5 rounded bg-slate-900 p-1" aria-hidden>
                      {Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} className={cn("rounded-[1px]", index % 3 === 0 ? "bg-white" : "bg-slate-900")} />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="absolute -bottom-3 -right-3 rounded-full border border-gold/40 bg-card px-3 py-1 text-[10px] font-medium text-gold shadow">
                  {t("certificates.sampleBadge")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-16 lg:pb-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-brand-2 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <div className="absolute inset-0 opacity-20" aria-hidden>
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-white blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-balance text-2xl font-extrabold sm:text-4xl">{t("home.ctaTitle")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">{t("home.ctaSubtitle")}</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                  <Link href="/register">{t("home.ctaButton")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                  <Link href="/courses">{t("home.ctaCourses")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  center,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  center?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", center && "flex-col items-center text-center")}>
      <div className={cn("max-w-2xl", center && "mx-auto")}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-balance text-2xl font-bold sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Button asChild variant="ghost" size="sm" className="gap-1 text-primary">
          <Link href={href}>
            {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="surface flex h-full flex-col p-6">
      <Quote className="h-6 w-6 text-primary/30" />
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {testimonial.quote}
      </blockquote>
      <div className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
        <UserAvatar name={testimonial.name} src={testimonial.avatar} className="h-9 w-9" />
        <figcaption className="min-w-0">
          <p className="truncate text-sm font-semibold">{testimonial.name}</p>
          <p className="truncate text-xs text-muted-foreground">{testimonial.role}</p>
        </figcaption>
        <div className="ml-auto flex items-center gap-0.5">
          {Array.from({ length: testimonial.rating }).map((_, index) => (
            <Star key={index} className="h-3 w-3 fill-gold text-gold" />
          ))}
        </div>
      </div>
    </figure>
  );
}

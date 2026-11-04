"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ExternalLink,
  Eye,
  Film,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { apiRequest, mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePortalLesson, useTeachers, type PortalLesson } from "@/lib/portal";
import { useCourse, useCategories } from "@/lib/queries";
import type { Course, CourseSection, LessonSummary, QuizManage } from "@/lib/types";
import { cn, formatDate, formatDuration, formatNumber } from "@/lib/utils";
import { PageHeading } from "@/features/dashboard/shared";
import { ConfirmDialog, StatusPill } from "./shared";
import { QuizEditorDialog } from "./quiz-editor-dialog";
import { VideoManagerDialog } from "./video-manager-dialog";

type Tab = "general" | "content";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CourseEditorPage({ role, slug }: { role: "teacher" | "admin"; slug: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isNew = slug === "new";
  const courseQuery = useCourse(slug, !isNew);
  const categories = useCategories();
  const teachers = useTeachers(role === "admin");
  const [tab, setTab] = useState<Tab>("general");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [form, setForm] = useState({
    title_uz: "",
    title_ru: "",
    short_description_uz: "",
    short_description_ru: "",
    description_uz: "",
    description_ru: "",
    category_id: "",
    level: "beginner",
    language: "uz",
    is_free: false,
    price: "",
    monthly_price: "",
    is_featured: false,
    meta_title: "",
    meta_description: "",
  });
  const hydratedId = useRef<number | null>(null);
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; section?: CourseSection }>({ open: false });
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean;
    sectionId: number;
    lesson?: LessonSummary;
    defaultOrder: number;
  }>({ open: false, sectionId: 0, defaultOrder: 0 });
  const [videoLesson, setVideoLesson] = useState<LessonSummary | null>(null);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "section" | "lesson";
    id: number;
    title: string;
  } | null>(null);

  const course = courseQuery.data;

  useEffect(() => {
    if (!course || hydratedId.current === course.id) return;
    hydratedId.current = course.id;
    setForm({
      title_uz: course.title_uz,
      title_ru: course.title_ru,
      short_description_uz: course.short_description_uz,
      short_description_ru: course.short_description_ru,
      description_uz: course.description_uz,
      description_ru: course.description_ru,
      category_id: String(course.category?.id ?? ""),
      level: course.level,
      language: course.language,
      is_free: course.is_free,
      price: course.price || "",
      monthly_price: course.monthly_price || "",
      is_featured: course.is_featured,
      meta_title: "",
      meta_description: "",
    });
    if (course.teacher?.id) setTeacherId(String(course.teacher.id));
  }, [course]);

  useEffect(() => {
    if (!thumbnail) {
      setThumbnailPreview(null);
      return;
    }
    const url = URL.createObjectURL(thumbnail);
    setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  const invalidateCourse = () => {
    queryClient.invalidateQueries({ queryKey: ["course"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  };

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: () => {
      if (!form.title_uz.trim() || !form.title_ru.trim() || !form.category_id) {
        throw new Error(t("portal.requiredFields"));
      }
      if (!form.is_free && !Number(form.monthly_price)) {
        throw new Error(t("portal.requiredFields"));
      }
      const formData = new FormData();
      formData.append("title_uz", form.title_uz.trim());
      formData.append("title_ru", form.title_ru.trim());
      formData.append("short_description_uz", form.short_description_uz);
      formData.append("short_description_ru", form.short_description_ru);
      formData.append("description_uz", form.description_uz);
      formData.append("description_ru", form.description_ru);
      formData.append("category_id", form.category_id);
      formData.append("level", form.level);
      formData.append("language", form.language);
      formData.append("is_free", form.is_free ? "true" : "false");
      formData.append("price", form.is_free ? "0" : form.price || "0");
      formData.append("monthly_price", form.is_free ? "0" : form.monthly_price || "0");
      formData.append("is_featured", form.is_featured ? "true" : "false");
      formData.append("meta_title", form.meta_title);
      formData.append("meta_description", form.meta_description);
      if (thumbnail) formData.append("thumbnail", thumbnail);
      if (role === "admin" && teacherId) formData.append("teacher_id", teacherId);
      return apiRequest<Course>(isNew ? "/api/courses/" : `/api/courses/${slug}/`, {
        method: isNew ? "POST" : "PATCH",
        formData,
      });
    },
    onSuccess: (data) => {
      toast.success(isNew ? t("teacher.courseCreated") : t("teacher.courseUpdated"));
      setThumbnail(null);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["course"] });
      if (isNew) {
        hydratedId.current = data.id;
        router.replace(`/${role}/courses/${data.slug}`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const publish = useMutation({
    mutationFn: (course: Course) =>
      apiRequest<Course>(`/api/courses/${course.slug}/${course.status === "published" ? "unpublish" : "publish"}/`, {
        method: "POST",
      }),
    onSuccess: (_data, item) => {
      toast.success(item.status === "published" ? t("portal.unpublish") : t("portal.publish"));
      invalidateCourse();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const remove = useMutation({
    mutationFn: (target: { kind: "section" | "lesson"; id: number }) =>
      apiRequest(`/api/${target.kind === "section" ? "sections" : "lessons"}/${target.id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(t("portal.deleted"));
      setDeleteTarget(null);
      invalidateCourse();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const createQuiz = useMutation({
    mutationFn: (lesson: LessonSummary) =>
      apiRequest<QuizManage>("/api/quizzes/", {
        method: "POST",
        body: {
          lesson: lesson.id,
          title_uz: `${lesson.title_uz} — test`,
          title_ru: `${lesson.title_ru} — тест`,
          description_uz: "",
          description_ru: "",
          passing_score: 7,
          total_questions: 10,
          randomize_questions: true,
          randomize_options: true,
          is_active: false,
          questions: [],
        },
      }),
    onSuccess: (data) => {
      toast.success(t("portal.quizCreated"));
      setQuizId(data.id);
      invalidateCourse();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  if (!isNew && courseQuery.isError) {
    return (
      <ErrorState
        message={courseQuery.error instanceof Error ? courseQuery.error.message : undefined}
        onRetry={() => courseQuery.refetch()}
      />
    );
  }

  const thumbnailUrl = thumbnailPreview || mediaUrl(course?.thumbnail);
  const sections = course?.sections ?? [];

  return (
    <div>
      <PageHeading
        eyebrow={role === "teacher" ? t("teacher.title") : t("admin.title")}
        title={isNew ? t("teacher.newCourse") : course?.title || t("portal.courseEditor")}
        subtitle={isNew ? t("teacher.noCoursesHint") : `${t("portal.lessonCount", { n: course?.lessons_count ?? 0 })} · ${t("teacher.studentsCount")}: ${formatNumber(course?.students_count ?? 0)}`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href={`/${role}/courses`}>
                <ArrowLeft className="h-4 w-4" />
                {t("portal.backToCourses")}
              </Link>
            </Button>
            {course ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => publish.mutate(course)}
                  disabled={publish.isPending}
                >
                  <Eye className="h-4 w-4" />
                  {course.status === "published" ? t("portal.unpublish") : t("portal.publish")}
                </Button>
                {course.status === "published" ? (
                  <Button asChild variant="ghost">
                    <Link href={`/courses/${course.slug}`} target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      {t("common.view")}
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button variant="gradient" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("portal.saveChanges")}
            </Button>
          </>
        }
      />

      {!isNew && course ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill status={course.status} />
          <span className="text-xs text-muted-foreground">
            {course.status === "published"
              ? `${t("portal.published")} · ${formatDate(course.published_at, lang)}`
              : t("portal.draft")}
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex gap-1 rounded-xl border border-border/70 bg-secondary/30 p-1">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors sm:flex-none",
            tab === "general" && "bg-primary/15 text-primary",
          )}
        >
          {t("teacher.general")}
        </button>
        <button
          type="button"
          disabled={isNew}
          onClick={() => setTab("content")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors disabled:opacity-50 sm:flex-none",
            tab === "content" && "bg-primary/15 text-primary",
          )}
        >
          {t("teacher.content")}
        </button>
      </div>

      {tab === "general" || isNew ? (
        <div className="surface p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("teacher.titleUz")}>
                  <Input value={form.title_uz} onChange={(event) => update({ title_uz: event.target.value })} />
                </Field>
                <Field label={t("teacher.titleRu")}>
                  <Input value={form.title_ru} onChange={(event) => update({ title_ru: event.target.value })} />
                </Field>
                <Field label={t("teacher.shortDescUz")}>
                  <Input
                    value={form.short_description_uz}
                    onChange={(event) => update({ short_description_uz: event.target.value })}
                  />
                </Field>
                <Field label={t("teacher.shortDescRu")}>
                  <Input
                    value={form.short_description_ru}
                    onChange={(event) => update({ short_description_ru: event.target.value })}
                  />
                </Field>
                <Field label={t("teacher.descUz")} className="sm:col-span-2">
                  <Textarea
                    value={form.description_uz}
                    onChange={(event) => update({ description_uz: event.target.value })}
                  />
                </Field>
                <Field label={t("teacher.descRu")} className="sm:col-span-2">
                  <Textarea
                    value={form.description_ru}
                    onChange={(event) => update({ description_ru: event.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("teacher.category")}>
                  <Select value={form.category_id} onValueChange={(value) => update({ category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("portal.selectOption")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.data?.results?.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {lang === "ru" ? category.name_ru : category.name_uz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("teacher.level")}>
                  <Select value={form.level} onValueChange={(value) => update({ level: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t("levels.beginner")}</SelectItem>
                      <SelectItem value="intermediate">{t("levels.intermediate")}</SelectItem>
                      <SelectItem value="advanced">{t("levels.advanced")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("teacher.language")}>
                  <Select value={form.language} onValueChange={(value) => update({ language: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uz">O'zbekcha</SelectItem>
                      <SelectItem value="ru">Русский</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {role === "admin" ? (
                  <Field label={t("roles.teacher")}>
                    <Select value={teacherId} onValueChange={setTeacherId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("portal.selectOption")} />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.data?.results?.map((teacher) => (
                          <SelectItem key={teacher.id} value={String(teacher.id)}>
                            {teacher.full_name} · {teacher.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!teachers.isLoading && !teachers.data?.results?.length ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {t("portal.requiredFields")}
                      </p>
                    ) : null}
                  </Field>
                ) : null}
              </div>

              <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.is_free} onCheckedChange={(checked) => update({ is_free: checked })} />
                    {t("teacher.isFree")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.is_featured}
                      onCheckedChange={(checked) => update({ is_featured: checked })}
                    />
                    {t("teacher.isFeatured")}
                  </label>
                  <Field label={t("teacher.priceUz")}>
                    <Input
                      type="number"
                      min={0}
                      disabled={form.is_free}
                      value={form.is_free ? "0" : form.price}
                      onChange={(event) => update({ price: event.target.value })}
                    />
                  </Field>
                  <Field label={t("teacher.monthlyPrice")}>
                    <Input
                      type="number"
                      min={0}
                      disabled={form.is_free}
                      value={form.is_free ? "0" : form.monthly_price}
                      onChange={(event) => update({ monthly_price: event.target.value })}
                    />
                  </Field>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("portal.metaTitle")}>
                  <Input value={form.meta_title} onChange={(event) => update({ meta_title: event.target.value })} />
                </Field>
                <Field label={t("portal.metaDescription")}>
                  <Input
                    value={form.meta_description}
                    onChange={(event) => update({ meta_description: event.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">{t("teacher.thumbnail")}</p>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-secondary">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <BookOpen className="h-8 w-8" />
                  </span>
                )}
              </div>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => setThumbnail(event.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">{t("portal.imageHint")}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{t("teacher.courseContent")}</p>
              <p className="text-xs text-muted-foreground">{t("portal.addSectionHint")}</p>
            </div>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => setSectionDialog({ open: true })}
            >
              <Plus className="h-4 w-4" />
              {t("teacher.addSection")}
            </Button>
          </div>

          {sections.length ? (
            sections.map((section) => (
              <section key={section.id} className="surface overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {section.order + 1}. {lang === "ru" ? section.title_ru : section.title_uz}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("portal.lessonCount", { n: section.lessons.length })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => setLessonDialog({ open: true, sectionId: section.id, defaultOrder: section.lessons.length })}
                      title={t("teacher.addLesson")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => setSectionDialog({ open: true, section })}
                      title={t("portal.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          kind: "section",
                          id: section.id,
                          title: lang === "ru" ? section.title_ru : section.title_uz,
                        })
                      }
                      title={t("portal.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {section.lessons.length ? (
                  <ul className="divide-y divide-border/60">
                    {section.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {lesson.order + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {lang === "ru" ? lesson.title_ru : lesson.title_uz}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(lesson.duration_seconds)}
                            </span>
                            {lesson.is_free_preview ? (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                                {t("portal.freePreview")}
                              </span>
                            ) : null}
                            <span className={lesson.has_video ? "text-emerald-600 dark:text-emerald-400" : ""}>
                              {t("portal.video")}: {lesson.has_video ? "✓" : "—"}
                            </span>
                            {lesson.quiz ? (
                              <span className="inline-flex items-center gap-1 text-primary">
                                <ListChecks className="h-3 w-3" />
                                {lesson.quiz.is_active ? t("teacher.active") : t("portal.draft")} ·{" "}
                                {t("portal.questionCountLabel", { n: lesson.quiz.total_questions })}
                              </span>
                            ) : (
                              <span>{t("portal.quiz")}: —</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => setVideoLesson(lesson)}
                            title={t("portal.manageVideos")}
                          >
                            <Film className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            disabled={createQuiz.isPending}
                            onClick={() => {
                              if (lesson.quiz) setQuizId(lesson.quiz.id);
                              else createQuiz.mutate(lesson);
                            }}
                            title={lesson.quiz ? t("teacher.manageQuiz") : t("teacher.addQuiz")}
                          >
                            <ListChecks className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() =>
                              setLessonDialog({
                                open: true,
                                sectionId: section.id,
                                lesson,
                                defaultOrder: lesson.order,
                              })
                            }
                            title={t("portal.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                kind: "lesson",
                                id: lesson.id,
                                title: lang === "ru" ? lesson.title_ru : lesson.title_uz,
                              })
                            }
                            title={t("portal.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("portal.noLessonsYet")}</p>
                )}
              </section>
            ))
          ) : (
            <div className="surface p-10 text-center text-sm text-muted-foreground">{t("portal.noSectionsYet")}</div>
          )}
        </div>
      )}

      <SectionDialog
        open={sectionDialog.open}
        onOpenChange={(open) => setSectionDialog({ open })}
        courseId={course?.id ?? 0}
        section={sectionDialog.section}
        nextOrder={sections.length}
        onSaved={invalidateCourse}
      />

      <LessonDialog
        open={lessonDialog.open}
        onOpenChange={(open) => setLessonDialog((current) => ({ ...current, open }))}
        sectionId={lessonDialog.sectionId}
        lesson={lessonDialog.lesson}
        defaultOrder={lessonDialog.defaultOrder}
        onSaved={invalidateCourse}
      />

      <VideoManagerDialog
        lesson={videoLesson}
        open={Boolean(videoLesson)}
        onOpenChange={(open) => !open && setVideoLesson(null)}
      />

      <QuizEditorDialog quizId={quizId} open={quizId !== null} onOpenChange={(open) => !open && setQuizId(null)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("portal.delete")}
        description={deleteTarget ? `${deleteTarget.title} — ${t("teacher.deleteConfirm")}` : undefined}
        confirmLabel={t("portal.delete")}
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate({ kind: deleteTarget.kind, id: deleteTarget.id })}
      />
    </div>
  );
}

function SectionDialog({
  open,
  onOpenChange,
  courseId,
  section,
  nextOrder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  section?: CourseSection;
  nextOrder: number;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("0");

  useEffect(() => {
    if (!open) return;
    setTitleUz(section?.title_uz ?? "");
    setTitleRu(section?.title_ru ?? "");
    setDescription(section?.description ?? "");
    setOrder(String(section?.order ?? nextOrder));
  }, [open, section, nextOrder]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!titleUz.trim() || !titleRu.trim()) throw new Error(t("portal.requiredFields"));
      const body = {
        course: courseId,
        title_uz: titleUz.trim(),
        title_ru: titleRu.trim(),
        description,
        order: Number(order) || 0,
      };
      return section
        ? apiRequest(`/api/sections/${section.id}/`, { method: "PATCH", body })
        : apiRequest("/api/sections/", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(section ? t("portal.saved") : t("teacher.sectionCreated"));
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{section ? t("portal.edit") : t("teacher.addSection")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("teacher.titleUz")}>
            <Input value={titleUz} onChange={(event) => setTitleUz(event.target.value)} />
          </Field>
          <Field label={t("teacher.titleRu")}>
            <Input value={titleRu} onChange={(event) => setTitleRu(event.target.value)} />
          </Field>
          <Field label={t("portal.description")}>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label={t("portal.order")}>
            <Input type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("portal.cancel")}
          </Button>
          <Button variant="gradient" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("portal.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LessonDialog({
  open,
  onOpenChange,
  sectionId,
  lesson,
  defaultOrder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: number;
  lesson?: LessonSummary;
  defaultOrder: number;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [descriptionUz, setDescriptionUz] = useState("");
  const [descriptionRu, setDescriptionRu] = useState("");
  const [order, setOrder] = useState("0");
  const [duration, setDuration] = useState("0");
  const [freePreview, setFreePreview] = useState(false);
  const detail = usePortalLesson(open && lesson ? lesson.id : null);

  useEffect(() => {
    if (!open) return;
    if (!lesson) {
      setTitleUz("");
      setTitleRu("");
      setDescriptionUz("");
      setDescriptionRu("");
      setOrder(String(defaultOrder));
      setDuration("0");
      setFreePreview(false);
    }
  }, [open, lesson, defaultOrder]);

  useEffect(() => {
    if (!open || !lesson || !detail.data) return;
    const data = detail.data as PortalLesson;
    setTitleUz(data.title_uz);
    setTitleRu(data.title_ru);
    setDescriptionUz(data.description_uz);
    setDescriptionRu(data.description_ru);
    setOrder(String(data.order));
    setDuration(String(data.duration_seconds));
    setFreePreview(data.is_free_preview);
  }, [open, lesson, detail.data]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!titleUz.trim() || !titleRu.trim()) throw new Error(t("portal.requiredFields"));
      const body = {
        section: sectionId,
        title_uz: titleUz.trim(),
        title_ru: titleRu.trim(),
        description_uz: descriptionUz,
        description_ru: descriptionRu,
        order: Number(order) || 0,
        duration_seconds: Number(duration) || 0,
        is_free_preview: freePreview,
      };
      return lesson
        ? apiRequest(`/api/lessons/${lesson.id}/`, { method: "PATCH", body })
        : apiRequest("/api/lessons/", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(lesson ? t("portal.saved") : t("teacher.lessonCreated"));
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lesson ? t("portal.edit") : t("teacher.addLesson")}</DialogTitle>
        </DialogHeader>
        {lesson && detail.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <Field label={t("teacher.titleUz")}>
              <Input value={titleUz} onChange={(event) => setTitleUz(event.target.value)} />
            </Field>
            <Field label={t("teacher.titleRu")}>
              <Input value={titleRu} onChange={(event) => setTitleRu(event.target.value)} />
            </Field>
            <Field label={`${t("teacher.lessonDesc")} (uz)`}>
              <Textarea value={descriptionUz} onChange={(event) => setDescriptionUz(event.target.value)} />
            </Field>
            <Field label={`${t("teacher.lessonDesc")} (ru)`}>
              <Textarea value={descriptionRu} onChange={(event) => setDescriptionRu(event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("portal.order")}>
                <Input type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
              </Field>
              <Field label={t("portal.durationSeconds")}>
                <Input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={freePreview} onCheckedChange={setFreePreview} />
              {t("portal.freePreview")}
            </label>
            <p className="text-[11px] text-muted-foreground">{t("portal.addLessonHint")}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("portal.cancel")}
          </Button>
          <Button
            variant="gradient"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (Boolean(lesson) && detail.isLoading)}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("portal.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

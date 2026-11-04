"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePortalQuiz } from "@/lib/portal";
import { cn } from "@/lib/utils";

type QuestionType = "single" | "multiple" | "image" | "text";

interface EditableOption {
  text_uz: string;
  text_ru: string;
  is_correct: boolean;
}

interface EditableQuestion {
  key: string;
  type: QuestionType;
  text_uz: string;
  text_ru: string;
  explanation_uz: string;
  explanation_ru: string;
  accepted_answers: string;
  points: number;
  image_url: string;
  image_base64: string;
  image_name: string;
  options: EditableOption[];
}

const blankOption = (): EditableOption => ({ text_uz: "", text_ru: "", is_correct: false });

const newQuestion = (index: number): EditableQuestion => ({
  key: `new-${index}-${Date.now()}`,
  type: "single",
  text_uz: "",
  text_ru: "",
  explanation_uz: "",
  explanation_ru: "",
  accepted_answers: "",
  points: 1,
  image_url: "",
  image_base64: "",
  image_name: "",
  options: [{ ...blankOption(), is_correct: true }, blankOption()],
});

export function QuizEditorDialog({
  quizId,
  open,
  onOpenChange,
}: {
  quizId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const quiz = usePortalQuiz(open ? quizId : null);
  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [descriptionUz, setDescriptionUz] = useState("");
  const [descriptionRu, setDescriptionRu] = useState("");
  const [passingScore, setPassingScore] = useState("7");
  const [totalQuestions, setTotalQuestions] = useState("10");
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quiz.data) return;
    const data = quiz.data;
    setTitleUz(data.title_uz);
    setTitleRu(data.title_ru);
    setDescriptionUz(data.description_uz);
    setDescriptionRu(data.description_ru);
    setPassingScore(String(data.passing_score));
    setTotalQuestions(String(data.total_questions));
    setRandomizeQuestions(data.randomize_questions);
    setRandomizeOptions(data.randomize_options);
    setIsActive(data.is_active);
    setQuestions(
      (data.questions ?? []).map((question, index) => ({
        key: `q-${question.id ?? index}`,
        type: question.type,
        text_uz: question.text_uz,
        text_ru: question.text_ru,
        explanation_uz: question.explanation_uz || "",
        explanation_ru: question.explanation_ru || "",
        accepted_answers: (question.accepted_answers ?? []).join("\n"),
        points: question.points || 1,
        image_url: typeof question.image === "string" ? question.image : "",
        image_base64: "",
        image_name: "",
        options:
          question.options?.length
            ? question.options.map((option) => ({
                text_uz: option.text_uz,
                text_ru: option.text_ru,
                is_correct: option.is_correct,
              }))
            : [blankOption(), blankOption()],
      })),
    );
    setError("");
  }, [quiz.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!quizId) throw new Error(t("portal.errorOccurred"));
      if (!titleUz.trim() || !titleRu.trim()) throw new Error(t("portal.requiredFields"));
      const payload = {
        title_uz: titleUz.trim(),
        title_ru: titleRu.trim(),
        description_uz: descriptionUz,
        description_ru: descriptionRu,
        passing_score: Number(passingScore) || 7,
        total_questions: Number(totalQuestions) || 10,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        is_active: isActive,
        questions: questions.map((question, index) => ({
          type: question.type,
          text_uz: question.text_uz,
          text_ru: question.text_ru,
          explanation_uz: question.explanation_uz,
          explanation_ru: question.explanation_ru,
          accepted_answers:
            question.type === "text"
              ? question.accepted_answers
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          order: index,
          points: Number(question.points) || 1,
          image_base64: question.image_base64 || undefined,
          image_url: !question.image_base64 && question.image_url ? question.image_url : undefined,
          options:
            question.type === "text"
              ? []
              : question.options.map((option, optionIndex) => ({
                  text_uz: option.text_uz,
                  text_ru: option.text_ru,
                  is_correct: option.is_correct,
                  order: optionIndex,
                })),
        })),
      };
      return apiRequest(`/api/quizzes/${quizId}/`, { method: "PUT", body: payload });
    },
    onSuccess: () => {
      toast.success(t("teacher.quizSaved"));
      queryClient.invalidateQueries({ queryKey: ["course"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "quiz", quizId] });
      onOpenChange(false);
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : t("portal.errorOccurred");
      setError(message);
      toast.error(message);
    },
  });

  const updateQuestion = (index: number, patch: Partial<EditableQuestion>) => {
    setQuestions((current) => current.map((question, itemIndex) => (itemIndex === index ? { ...question, ...patch } : question)));
  };

  const updateOption = (questionIndex: number, optionIndex: number, patch: Partial<EditableOption>) => {
    setQuestions((current) =>
      current.map((question, index) => {
        if (index !== questionIndex) return question;
        const options = question.options.map((option, itemIndex) => {
          if (itemIndex !== optionIndex) return option;
          if (patch.is_correct && question.type === "single") {
            return { ...option, ...patch };
          }
          return { ...option, ...patch };
        });
        if (patch.is_correct && question.type === "single") {
          return {
            ...question,
            options: options.map((option, itemIndex) =>
              itemIndex === optionIndex ? option : { ...option, is_correct: false },
            ),
          };
        }
        return { ...question, options };
      }),
    );
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((current) =>
      current.map((question, index) => {
        if (index !== questionIndex || question.options.length <= 2) return question;
        return { ...question, options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex) };
      }),
    );
  };

  const addOption = (questionIndex: number) => {
    setQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex ? { ...question, options: [...question.options, blankOption()] } : question,
      ),
    );
  };

  const handleImage = (questionIndex: number, file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("portal.imageHint"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateQuestion(questionIndex, {
        image_base64: typeof reader.result === "string" ? reader.result : "",
        image_name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("portal.quizEditor")}</DialogTitle>
          <DialogDescription>
            {quiz.data
              ? `${quiz.data.course_slug} · ${quiz.data.lesson_title_uz}`
              : t("common.loading")}
          </DialogDescription>
        </DialogHeader>

        {quiz.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : quiz.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {quiz.error instanceof Error ? quiz.error.message : t("portal.errorOccurred")}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quiz-title-uz">{t("portal.titleUz")}</Label>
                <Input id="quiz-title-uz" value={titleUz} onChange={(event) => setTitleUz(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiz-title-ru">{t("portal.titleRu")}</Label>
                <Input id="quiz-title-ru" value={titleRu} onChange={(event) => setTitleRu(event.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="quiz-desc-uz">{t("teacher.lessonDesc")} (uz)</Label>
                <Textarea
                  id="quiz-desc-uz"
                  value={descriptionUz}
                  onChange={(event) => setDescriptionUz(event.target.value)}
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="quiz-desc-ru">{t("teacher.lessonDesc")} (ru)</Label>
                <Textarea
                  id="quiz-desc-ru"
                  value={descriptionRu}
                  onChange={(event) => setDescriptionRu(event.target.value)}
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiz-passing">{t("teacher.passingScore")}</Label>
                <Input
                  id="quiz-passing"
                  type="number"
                  min={1}
                  value={passingScore}
                  onChange={(event) => setPassingScore(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiz-total">{t("teacher.totalQuestions")}</Label>
                <Input
                  id="quiz-total"
                  type="number"
                  min={1}
                  value={totalQuestions}
                  onChange={(event) => setTotalQuestions(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("portal.questionCountLabel", { n: questions.length })}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={randomizeQuestions} onCheckedChange={setRandomizeQuestions} />
                {t("teacher.randomize")} — {t("portal.question")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={randomizeOptions} onCheckedChange={setRandomizeOptions} />
                {t("teacher.randomize")} — {t("portal.options")}
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                {t("teacher.active")}
                <span className="text-[11px] text-muted-foreground">{t("portal.quizActiveHint")}</span>
              </label>
            </div>

            <div className="space-y-3">
              {questions.map((question, questionIndex) => (
                <div key={question.key} className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {t("portal.question")} {questionIndex + 1}
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={question.type}
                        onValueChange={(value: QuestionType) => updateQuestion(questionIndex, { type: value })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">{t("portal.questionTypes.single")}</SelectItem>
                          <SelectItem value="multiple">{t("portal.questionTypes.multiple")}</SelectItem>
                          <SelectItem value="image">{t("portal.questionTypes.image")}</SelectItem>
                          <SelectItem value="text">{t("portal.questionTypes.text")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={question.points}
                        onChange={(event) =>
                          updateQuestion(questionIndex, { points: Number(event.target.value) || 1 })
                        }
                        className="h-8 w-16 text-xs"
                        title={t("portal.points")}
                      />
                      <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setQuestions((current) => current.filter((_, index) => index !== questionIndex))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t("teacher.questionTextUz")}</Label>
                      <Textarea
                        value={question.text_uz}
                        onChange={(event) => updateQuestion(questionIndex, { text_uz: event.target.value })}
                        className="min-h-[70px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("teacher.questionTextRu")}</Label>
                      <Textarea
                        value={question.text_ru}
                        onChange={(event) => updateQuestion(questionIndex, { text_ru: event.target.value })}
                        className="min-h-[70px]"
                      />
                    </div>
                  </div>

                  {question.type === "image" ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`question-image-${questionIndex}`}>{t("portal.questionImage")}</Label>
                      {question.image_url && !question.image_base64 ? (
                        <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={question.image_url} alt="" className="h-16 w-24 rounded object-cover" />
                          <span className="text-[11px] text-muted-foreground">{t("portal.existingImage")}</span>
                        </div>
                      ) : null}
                      {question.image_base64 ? (
                        <p className="text-[11px] text-muted-foreground">{question.image_name}</p>
                      ) : null}
                      <Input
                        id={`question-image-${questionIndex}`}
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleImage(questionIndex, event.target.files?.[0] ?? null)}
                      />
                      <p className="text-[11px] text-muted-foreground">{t("portal.imageHint")}</p>
                    </div>
                  ) : null}

                  {question.type === "text" ? (
                    <div className="mt-3 space-y-1.5">
                      <Label>{t("teacher.acceptedAnswers")}</Label>
                      <Textarea
                        value={question.accepted_answers}
                        onChange={(event) =>
                          updateQuestion(questionIndex, { accepted_answers: event.target.value })
                        }
                        placeholder={"javob 1\njavob 2"}
                      />
                      <p className="text-[11px] text-muted-foreground">{t("portal.textAnswersHint")}</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <Label>{t("teacher.options")}</Label>
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <Checkbox
                            checked={option.is_correct}
                            onCheckedChange={(checked) =>
                              updateOption(questionIndex, optionIndex, { is_correct: checked === true })
                            }
                            aria-label={t("portal.correct")}
                          />
                          <Input
                            value={option.text_uz}
                            onChange={(event) =>
                              updateOption(questionIndex, optionIndex, { text_uz: event.target.value })
                            }
                            placeholder="uz"
                            className="h-9"
                          />
                          <Input
                            value={option.text_ru}
                            onChange={(event) =>
                              updateOption(questionIndex, optionIndex, { text_ru: event.target.value })
                            }
                            placeholder="ru"
                            className="h-9"
                          />
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className={cn("text-muted-foreground", question.options.length <= 2 && "opacity-40")}
                            disabled={question.options.length <= 2}
                            onClick={() => removeOption(questionIndex, optionIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addOption(questionIndex)}>
                        <Plus className="h-4 w-4" />
                        {t("teacher.addOption")}
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t("teacher.explanationUz")}</Label>
                      <Textarea
                        value={question.explanation_uz}
                        onChange={(event) => updateQuestion(questionIndex, { explanation_uz: event.target.value })}
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("teacher.explanationRu")}</Label>
                      <Textarea
                        value={question.explanation_ru}
                        onChange={(event) => updateQuestion(questionIndex, { explanation_ru: event.target.value })}
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setQuestions((current) => [...current, newQuestion(current.length)])}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              {t("portal.addQuestion")}
            </Button>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                {t("portal.cancel")}
              </Button>
              <Button variant="gradient" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {t("portal.saveQuiz")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

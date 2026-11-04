"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ListChecks,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryKeys } from "@/lib/queries";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";
import type {
  AttemptQuestion,
  Paginated,
  QuizAttemptDetail,
  QuizAttemptSummary,
  QuizStartResponse,
  QuizStudent,
} from "@/lib/types";

type QuizStage = "intro" | "questions" | "result";

interface QuizPanelProps {
  quiz: QuizStudent;
  courseSlug: string;
  nextLessonId?: number | null;
  videoCompleted: boolean;
  onExit: () => void;
  onNextLesson: (lessonId: number) => void;
}

interface AnswerDraft {
  selected_options: number[];
  text_answer: string;
}

export function QuizPanel({
  quiz,
  courseSlug,
  nextLessonId,
  videoCompleted,
  onExit,
  onNextLesson,
}: QuizPanelProps) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<QuizStage>("intro");
  const [startData, setStartData] = useState<QuizStartResponse | null>(null);
  const [result, setResult] = useState<QuizAttemptDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerDraft>>({});

  const attempts = useQuery({
    queryKey: ["quiz-attempts", quiz.id, lang],
    queryFn: () =>
      apiRequest<Paginated<QuizAttemptSummary>>(`/api/quizzes/${quiz.id}/attempts/`, {
        lang,
        query: { page_size: 5 },
      }),
    enabled: stage === "intro",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.course(courseSlug) });
    queryClient.invalidateQueries({ queryKey: ["lesson", courseSlug] });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: queryKeys.certificates });
    queryClient.invalidateQueries({ queryKey: ["quiz-attempts", quiz.id] });
    queryClient.invalidateQueries({ queryKey: ["continue-learning"] });
  };

  const start = useMutation({
    mutationFn: () => apiRequest<QuizStartResponse>(`/api/quizzes/${quiz.id}/start/`, { method: "POST" }),
    onSuccess: (data) => {
      setStartData(data);
      setAnswers({});
      setIndex(0);
      setResult(null);
      setStage("questions");
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const submit = useMutation({
    mutationFn: () => {
      if (!startData) throw new Error("not-started");
      const payload = startData.questions.map((question) => {
        const draft = answers[question.id];
        return {
          question_id: question.id,
          selected_options: draft?.selected_options ?? [],
          text_answer: draft?.text_answer ?? "",
        };
      });
      return apiRequest<QuizAttemptDetail>(`/api/quiz-attempts/${startData.attempt.id}/submit/`, {
        method: "POST",
        body: { answers: payload },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setStage("result");
      invalidate();
      toast.success(t("toast.quizSubmitted"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const questions = startData?.questions ?? [];
  const current: AttemptQuestion | undefined = questions[index];
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const draft = answers[question.id];
        if (!draft) return false;
        return question.type === "text" ? Boolean(draft.text_answer.trim()) : draft.selected_options.length > 0;
      }).length,
    [answers, questions],
  );
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const setAnswer = (questionId: number, patch: Partial<AnswerDraft>) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: {
        selected_options: previous[questionId]?.selected_options ?? [],
        text_answer: previous[questionId]?.text_answer ?? "",
        ...patch,
      },
    }));
  };

  const toggleOption = (question: AttemptQuestion, optionId: number) => {
    const draft = answers[question.id] ?? { selected_options: [], text_answer: "" };
    if (question.type === "multiple") {
      const next = draft.selected_options.includes(optionId)
        ? draft.selected_options.filter((id) => id !== optionId)
        : [...draft.selected_options, optionId];
      setAnswer(question.id, { selected_options: next });
    } else {
      setAnswer(question.id, { selected_options: [optionId] });
    }
  };

  const restart = () => {
    setStartData(null);
    setResult(null);
    setAnswers({});
    setIndex(0);
    setStage("intro");
    start.mutate();
  };

  if (stage === "questions" && startData && current) {
    const draft = answers[current.id] ?? { selected_options: [], text_answer: "" };
    const canSubmit = allAnswered && !submit.isPending;

    return (
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{startData.quiz.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("learn.questionOf", { current: index + 1, total: questions.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">
              {t("learn.answersProgress", { n: answeredCount, total: questions.length })}
            </Badge>
            <Button size="sm" variant="ghost" onClick={onExit}>
              {t("learn.exitQuiz")}
            </Button>
          </div>
        </div>

        <div className="px-4 pb-2 pt-4 sm:px-6">
          <Progress value={((index + 1) / questions.length) * 100} className="h-1.5" />
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <CircleHelp className="h-3.5 w-3.5" />
              {current.type === "multiple" ? t("learn.multiHint") : current.type === "text" ? t("learn.textAnswerPlaceholder") : t("learn.singleHint")}
              <span className="ml-auto">{current.points} {t("common.pointsShort")}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug">{current.text}</h2>
            {current.image ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-border/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(current.image) || ""}
                  alt=""
                  className="max-h-64 w-full object-contain"
                />
              </div>
            ) : null}
          </div>

          {current.type === "text" ? (
            <Textarea
              value={draft.text_answer}
              onChange={(event) => setAnswer(current.id, { text_answer: event.target.value })}
              placeholder={t("learn.textAnswerPlaceholder")}
              className="min-h-[110px]"
            />
          ) : current.type === "multiple" ? (
            <div className="space-y-2">
              {current.options.map((option) => {
                const checked = draft.selected_options.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(current, option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      checked ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
                    )}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span>{option.text}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <RadioGroup
              value={draft.selected_options[0] ? String(draft.selected_options[0]) : ""}
              onValueChange={(value) => setAnswer(current.id, { selected_options: [Number(value)] })}
              className="gap-2"
            >
              {current.options.map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                    draft.selected_options.includes(option.id)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <RadioGroupItem value={String(option.id)} />
                  <span>{option.text}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
            <Button
              variant="outline"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("learn.prevShort")}
            </Button>

            <div className="flex flex-wrap gap-2">
              {index < questions.length - 1 ? (
                <Button onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>
                  {t("learn.nextShort")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  disabled={!canSubmit}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  {submit.isPending ? t("learn.submitting") : t("learn.submitQuiz")}
                </Button>
              )}
            </div>
          </div>

          {!allAnswered ? (
            <p className="text-center text-[11px] text-muted-foreground">
              {t("learn.answersProgress", { n: answeredCount, total: questions.length })}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (stage === "result" && result && startData) {
    const questionsById = new Map(startData.questions.map((question) => [question.id, question]));
    return (
      <section className="surface overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold">{startData.quiz.title}</p>
          <p className="text-[11px] text-muted-foreground">{t("learn.yourScore")}</p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border p-6 text-center",
              result.passed ? "border-emerald-500/30 bg-emerald-500/8" : "border-destructive/25 bg-destructive/5",
            )}
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                result.passed ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/10 text-destructive",
              )}
            >
              {result.passed ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
            </span>
            <p className="text-3xl font-extrabold">
              {result.correct_count}
              <span className="text-lg text-muted-foreground">/{result.total_questions}</span>
            </p>
            <Badge variant={result.passed ? "success" : "destructive"}>
              {result.passed ? t("learn.passedMessage") : t("learn.failedMessage")}
            </Badge>
            {result.restart_required ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t("learn.restartRequired")}</p>
            ) : null}
            <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span>
                {t("learn.correct")}: <strong className="text-emerald-500">{result.correct_count}</strong>
              </span>
              <span>
                {t("learn.wrong")}: <strong className="text-destructive">{result.wrong_count}</strong>
              </span>
              <span>
                {t("learn.passingScore")}: <strong>{startData.passing_score}</strong>
              </span>
            </div>
          </div>

          {result.passed && nextLessonId ? (
            <Button className="w-full" variant="gradient" onClick={() => onNextLesson(nextLessonId)}>
              {t("learn.continueNext")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="w-full" variant="outline" onClick={restart} disabled={start.isPending}>
              {start.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              {t("learn.retryQuiz")}
            </Button>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("learn.reviewAnswers")}
            </p>
            {result.answers.map((answer, position) => {
              const question = questionsById.get(answer.question_id);
              if (!question) return null;
              const correctIds = new Set(answer.correct_option_ids);
              return (
                <div
                  key={answer.question_id}
                  className={cn(
                    "rounded-xl border p-3.5",
                    answer.is_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-[10px] font-bold text-muted-foreground">#{position + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{question.text}</p>
                      {question.type !== "text" ? (
                        <ul className="mt-2 space-y-1 text-xs">
                          {question.options.map((option) => {
                            const isCorrect = correctIds.has(option.id);
                            const isSelected = answer.selected_options.includes(option.id);
                            return (
                              <li
                                key={option.id}
                                className={cn(
                                  "rounded-md px-2 py-1",
                                  isCorrect
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : isSelected
                                      ? "bg-destructive/10 text-destructive"
                                      : "text-muted-foreground",
                                )}
                              >
                                {option.text}
                                {isCorrect ? ` · ${t("learn.correctAnswer")}` : isSelected ? ` · ${t("learn.yourAnswer")}` : ""}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t("learn.yourAnswer")}: {answer.text_answer || "—"}
                        </p>
                      )}
                      {answer.explanation ? (
                        <p className="mt-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                          {answer.explanation}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="ghost" className="w-full" onClick={onExit}>
            {t("learn.backToLesson")}
          </Button>
        </div>
      </section>
    );
  }

  const history = attempts.data?.results ?? [];
  const canStart = videoCompleted || quiz.passed;

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
        <ListChecks className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t("learn.quizTitle")}</h2>
        {quiz.passed ? <Badge variant="success" className="ml-auto">{t("learn.passed")}</Badge> : null}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-bold">{quiz.title}</h3>
          {quiz.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <InfoTile icon={CircleHelp} label={t("learn.questions")} value={String(quiz.total_questions)} />
          <InfoTile icon={Target} label={t("learn.passingScore")} value={String(quiz.passing_score)} />
          <InfoTile icon={RotateCcw} label={t("learn.attempts")} value={String(quiz.attempts_count)} />
          <InfoTile icon={Clock3} label={t("learn.bestScore")} value={`${quiz.best_score}/${quiz.total_questions}`} />
        </div>

        <p className="text-sm text-muted-foreground">
          {t("learn.quizText", { n: quiz.total_questions, pass: quiz.passing_score })}
        </p>

        {!videoCompleted ? (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            {t("learn.lockedQuiz")}
          </p>
        ) : (
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
            {t("learn.quizIntroText")}
          </p>
        )}

        <Button
          className="w-full"
          variant="gradient"
          disabled={!canStart || start.isPending}
          onClick={() => start.mutate()}
        >
          {start.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CircleHelp />
          )}
          {quiz.passed
            ? t("learn.retryQuiz")
            : quiz.in_progress_attempt_id
              ? t("learn.resumeQuiz")
              : t("learn.startQuiz")}
        </Button>

        {history.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("learn.attemptHistory")}
            </p>
            <ul className="space-y-1.5">
              {history.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">
                    {t("learn.attempt")} #{attempt.attempt_number} · {formatDateTime(attempt.started_at, lang)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">
                      {attempt.correct_count}/{attempt.total_questions}
                    </span>
                    <Badge variant={attempt.passed ? "success" : "destructive"} className="px-1.5 py-0 text-[10px]">
                      {attempt.passed ? t("learn.passed") : t("learn.failed")}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">{t("learn.noAttempts")}</p>
        )}
      </div>
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

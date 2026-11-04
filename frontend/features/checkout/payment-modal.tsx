"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryKeys } from "@/lib/queries";
import { cn, formatMoney, getErrorMessage } from "@/lib/utils";
import type { CourseDetail, Payment } from "@/lib/types";

interface PaymentModalProps {
  course: CourseDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPeriod?: "monthly" | "full";
}

const providerIcons: Record<string, typeof CreditCard> = {
  click: Smartphone,
  payme: Wallet,
  uzum: CreditCard,
  sandbox: FlaskConical,
  manual: CreditCard,
};

type Step = "form" | "pending" | "success" | "failed";

export function PaymentModal({ course, open, onOpenChange, defaultPeriod = "monthly" }: PaymentModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"monthly" | "full">("monthly");
  const [provider, setProvider] = useState<string>("");
  const [step, setStep] = useState<Step>("form");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");

  const methods = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => apiRequest<{ providers: { id: string; label: string; enabled: boolean }[] }>("/api/payments/methods/"),
    enabled: open,
  });

  const available = useMemo(
    () => (methods.data?.providers || []).filter((item) => item.enabled),
    [methods.data],
  );

  useEffect(() => {
    if (open && available.length > 0 && !available.some((item) => item.id === provider)) {
      setProvider(available[0].id);
    }
  }, [available, open, provider]);

  useEffect(() => {
    if (open) {
      setPeriod(defaultPeriod);
      setStep("form");
      setPayment(null);
      setError("");
    }
  }, [open, defaultPeriod]);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setPayment(null);
      setError("");
    }
  }, [open]);

  const amount =
    period === "full" ? Number(course.effective_price) : Number(course.effective_monthly_price);
  const oldAmount = period === "full" ? Number(course.old_price || course.price) : Number(course.monthly_price);
  const showOld = course.discount_percent > 0 && oldAmount > amount;

  const checkout = useMutation({
    mutationFn: () =>
      apiRequest<{ payment: Payment; checkout_url: string }>("/api/payments/checkout/", {
        method: "POST",
        body: { course_slug: course.slug, provider, billing_period: period },
      }),
    onSuccess: (data) => {
      setPayment(data.payment);
      if (data.payment.provider === "sandbox") {
        setStep("pending");
      } else {
        setStep("pending");
        if (data.checkout_url) window.open(data.checkout_url, "_blank", "noopener,noreferrer");
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.payments });
    },
    onError: (err) => {
      setError(getErrorMessage(err, t("payments.failedText")));
      toast.error(getErrorMessage(err, t("payments.failedText")));
    },
  });

  const confirmSandbox = useMutation({
    mutationFn: () =>
      apiRequest<{ payment: Payment }>(`/api/payments/${payment?.id}/sandbox_confirm/`, { method: "POST" }),
    onSuccess: (data) => {
      setPayment(data.payment);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: queryKeys.course(course.slug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(t("payments.successText"));
    },
    onError: (err) => {
      setStep("failed");
      setError(getErrorMessage(err, t("payments.failedText")));
    },
  });

  useEffect(() => {
    if (step !== "pending" || !payment || payment.provider === "sandbox") return;
    const timer = setInterval(async () => {
      try {
        const latest = await apiRequest<Payment>(`/api/payments/${payment.id}/`);
        if (latest.status === "success") {
          setPayment(latest);
          setStep("success");
          queryClient.invalidateQueries({ queryKey: queryKeys.course(course.slug) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          queryClient.invalidateQueries({ queryKey: queryKeys.enrollments });
          queryClient.invalidateQueries({ queryKey: ["courses"] });
        } else if (["failed", "canceled", "refunded"].includes(latest.status)) {
          setPayment(latest);
          setStep("failed");
        }
      } catch {
        // keep polling while the user completes the payment
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [step, payment, course.slug, queryClient]);

  const goToCourse = async () => {
    try {
      const data = await apiRequest<{ course_slug: string; lesson_id: number }>(
        `/api/courses/${course.slug}/learn/`,
      );
      onOpenChange(false);
      router.push(`/learn/${data.course_slug}/${data.lesson_id}`);
    } catch {
      onOpenChange(false);
      router.push(`/courses/${course.slug}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : step === "failed" ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CreditCard className="h-5 w-5 text-primary" />
            )}
            {step === "success"
              ? t("payments.successTitle")
              : step === "failed"
                ? t("payments.failedTitle")
                : t("payments.checkoutTitle")}
          </DialogTitle>
          <DialogDescription>
            {step === "success"
              ? t("payments.successText")
              : step === "failed"
                ? error || t("payments.failedText")
                : t("payments.checkoutSubtitle")}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-xs text-muted-foreground">{course.title}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPeriod("monthly")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    period === "monthly"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <p className="text-xs font-medium text-muted-foreground">{t("course.monthly")}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatMoney(course.effective_monthly_price)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t("subscriptions.daysLeft", { n: 30 })}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("full")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    period === "full"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <p className="text-xs font-medium text-muted-foreground">{t("course.fullCourse")}</p>
                  <p className="mt-1 text-sm font-semibold">{formatMoney(course.effective_price)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{t("course.lifetimeAccess")}</p>
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t("course.choosePayment")}</p>
              {methods.isLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="skeleton h-14 rounded-xl" />
                  ))}
                </div>
              ) : available.length === 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                  {t("payments.secure")}. {t("footer.support")}: {t("footer.contact")}.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {available.map((item) => {
                    const Icon = providerIcons[item.id] || CreditCard;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setProvider(item.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          provider === item.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                        {provider === item.id && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">{t("common.total")}</span>
              <div className="text-right">
                <span className="text-lg font-bold">{formatMoney(amount)}</span>
                {showOld && (
                  <span className="ml-2 text-xs text-muted-foreground line-through">
                    {formatMoney(oldAmount)}
                  </span>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              variant="gradient"
              disabled={!provider || checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {checkout.isPending ? t("payments.processing") : t("payments.payNow")}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("payments.secure")}
            </p>
          </div>
        )}

        {step === "pending" && payment && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("payments.provider")}</span>
                <Badge variant="outline">{payment.provider_label}</Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("payments.amount")}</span>
                <span className="font-semibold">{formatMoney(payment.amount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("payments.status")}</span>
                <Badge variant="warning">{t("payments.statuses.pending")}</Badge>
              </div>
            </div>

            {payment.provider === "sandbox" ? (
              <>
                <p className="text-sm text-muted-foreground">{t("payments.sandboxNote")}</p>
                <Button
                  className="w-full"
                  size="lg"
                  variant="gradient"
                  onClick={() => confirmSandbox.mutate()}
                  disabled={confirmSandbox.isPending}
                >
                  {confirmSandbox.isPending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                  {t("payments.sandboxPay")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("payments.pendingText")}</p>
                {payment.checkout_url && (
                  <Button asChild className="w-full" size="lg" variant="gradient">
                    <a href={payment.checkout_url} target="_blank" rel="noopener noreferrer">
                      {t("payments.openPayment")} <ArrowUpRight />
                    </a>
                  </Button>
                )}
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("payments.pendingTitle")}
                </p>
              </>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">{t("payments.successText")}</p>
            <Button className="w-full" size="lg" variant="gradient" onClick={goToCourse}>
              {t("payments.goToCourse")}
            </Button>
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">{error || t("payments.failedText")}</p>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => {
                setStep("form");
                setError("");
                setPayment(null);
              }}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

export function ResetPasswordForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(8, t("auth.passwordMin")),
          password_confirm: z.string().min(1, t("auth.fieldRequired")),
        })
        .refine((values) => values.password === values.password_confirm, {
          path: ["password_confirm"],
          message: t("auth.passwordsMismatch"),
        }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirm: "" },
  });

  const reset = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest("/api/auth/password-reset/confirm/", {
        method: "POST",
        auth: false,
        body: { token, ...values },
      }),
    onSuccess: () => setDone(true),
    onError: (err) => setError(getErrorMessage(err, t("auth.resetFailed"))),
  });

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <XCircle className="h-8 w-8" />
        </span>
        <h1 className="font-display text-2xl font-bold">{t("auth.resetFailed")}</h1>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/forgot-password">{t("auth.resetTitle")}</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold">{t("auth.setPassword")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.resetDone")}</p>
        </div>
        <Button asChild size="lg" variant="gradient" className="w-full">
          <Link href="/login">{t("auth.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("auth.setPassword")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.passwordHint")}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={form.handleSubmit((values) => {
          setError("");
          reset.mutate(values);
        })}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.newPassword")}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password_confirm">{t("auth.confirmPassword")}</Label>
          <PasswordInput
            id="password_confirm"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password_confirm)}
            {...form.register("password_confirm")}
          />
          {form.formState.errors.password_confirm && (
            <p className="text-xs text-destructive">{form.formState.errors.password_confirm.message}</p>
          )}
        </div>

        <Button type="submit" size="lg" variant="gradient" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {t("auth.setPassword")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, t("auth.fieldRequired")).email(t("auth.emailInvalid")),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const request = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest("/api/auth/password-reset/", { method: "POST", auth: false, body: values }),
    onSuccess: () => setSent(true),
    onError: (err) => setError(getErrorMessage(err, t("toast.error"))),
  });

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-8 w-8" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold">{t("auth.resetTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.resetSent")}</p>
        </div>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft />
            {t("auth.backToLogin")}
          </Link>
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
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("auth.resetTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.resetSubtitle")}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={form.handleSubmit((values) => {
          setError("");
          request.mutate(values);
        })}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <Button type="submit" size="lg" variant="gradient" className="w-full" disabled={request.isPending}>
          {request.isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
          {t("auth.sendReset")}
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

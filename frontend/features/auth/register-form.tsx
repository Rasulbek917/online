"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MailCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { GoogleButton } from "@/components/shared/google-button";
import { ApiError, apiRequest } from "@/lib/api";
import { dashboardPathFor, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

export function RegisterForm() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { register: registerAccount, user, loading, isAuthenticated } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");

  const next = useMemo(() => {
    const value = params.get("next");
    return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
  }, [params]);

  const schema = useMemo(
    () =>
      z
        .object({
          first_name: z.string().min(1, t("auth.fieldRequired")),
          last_name: z.string().optional(),
          email: z.string().min(1, t("auth.fieldRequired")).email(t("auth.emailInvalid")),
          phone: z.string().optional(),
          password: z.string().min(8, t("auth.passwordMin")),
          password_confirm: z.string().min(1, t("auth.fieldRequired")),
          accept_terms: z.boolean().refine(Boolean, t("auth.termsRequired")),
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
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      password_confirm: "",
      accept_terms: false,
    },
  });

  useEffect(() => {
    if (!loading && user && !registered) router.replace(next || dashboardPathFor(user.role));
  }, [user, loading, registered, next, router]);

  const resend = useMutation({
    mutationFn: () => apiRequest("/api/auth/resend-verification/", { method: "POST" }),
    onSuccess: () => toast.success(t("auth.resent")),
    onError: (err) => toast.error(getErrorMessage(err, t("toast.error"))),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    try {
      const account = await registerAccount({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        password_confirm: values.password_confirm,
        language: lang,
        accept_terms: values.accept_terms,
      });
      setRegistered(true);
      toast.success(t("auth.accountCreated"));
      if (next) router.replace(next);
      else if (account.role !== "student") router.replace(dashboardPathFor(account.role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("auth.tooManyAttempts"));
      } else if (err instanceof ApiError && /already exists/i.test(err.message)) {
        setError(t("auth.emailExists"));
      } else {
        setError(getErrorMessage(err, t("toast.error")));
      }
    }
  });

  if (registered) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold">{t("auth.verifyPrompt")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.accountCreated")}</p>
          <p className="text-sm text-muted-foreground">{t("auth.verifyPromptText")}</p>
        </div>
        <div className="space-y-2">
          {isAuthenticated && (
            <Button
              size="lg"
              variant="gradient"
              className="w-full"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {resend.isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
              {t("auth.resend")}
            </Button>
          )}
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href={next || dashboardPathFor(user?.role)}>{t("nav.dashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("auth.registerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.registerSubtitle")}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">{t("auth.firstName")}</Label>
            <Input
              id="first_name"
              autoComplete="given-name"
              aria-invalid={Boolean(form.formState.errors.first_name)}
              {...form.register("first_name")}
            />
            {form.formState.errors.first_name && (
              <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name">
              {t("auth.lastName")} <span className="text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Input id="last_name" autoComplete="family-name" {...form.register("last_name")} />
          </div>
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="phone">
            {t("auth.phone")} <span className="text-muted-foreground">({t("common.optional")})</span>
          </Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="+998 90 123 45 67" {...form.register("phone")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t("auth.passwordHint")}</p>
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
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-2.5">
            <Controller
              control={form.control}
              name="accept_terms"
              render={({ field }) => (
                <Checkbox
                  id="accept_terms"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="accept_terms" className="text-xs font-normal leading-relaxed text-muted-foreground">
              {t("auth.termsAgree")}{" "}
              <Link href="/terms" className="text-primary hover:underline">
                {t("legal.termsTitle")}
              </Link>{" "}
              {t("common.and")}{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                {t("legal.privacyTitle")}
              </Link>
            </Label>
          </div>
          {form.formState.errors.accept_terms && (
            <p className="text-xs text-destructive">{form.formState.errors.accept_terms.message}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          variant="gradient"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {t("auth.signUp")}
        </Button>
      </form>

      <GoogleButton next={next} />

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-semibold text-primary hover:underline"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}

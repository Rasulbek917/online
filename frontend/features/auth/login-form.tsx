"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { GoogleButton } from "@/components/shared/google-button";
import { ApiError } from "@/lib/api";
import { dashboardPathFor, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { login, user, loading } = useAuth();
  const [error, setError] = useState("");

  const next = useMemo(() => {
    const value = params.get("next");
    return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
  }, [params]);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, t("auth.fieldRequired")).email(t("auth.emailInvalid")),
        password: z.string().min(1, t("auth.fieldRequired")),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!loading && user) router.replace(next || dashboardPathFor(user.role));
  }, [user, loading, next, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    try {
      const account = await login(values);
      toast.success(t("auth.loginSuccess"));
      router.replace(next || dashboardPathFor(account.role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("auth.tooManyAttempts"));
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t("auth.loginError"));
      } else {
        setError(getErrorMessage(err, t("auth.loginError")));
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogIn className="h-5 w-5" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          variant="gradient"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {t("auth.signIn")}
          {!form.formState.isSubmitting && <ArrowRight />}
        </Button>
      </form>

      <GoogleButton next={next} />

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-semibold text-primary hover:underline"
        >
          {t("auth.signUp")}
        </Link>
      </p>
    </div>
  );
}

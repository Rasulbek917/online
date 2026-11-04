"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

type Status = "verifying" | "success" | "error";

export function VerifyEmailStatus() {
  const { t } = useI18n();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        await apiRequest("/api/auth/verify-email/", {
          method: "POST",
          auth: false,
          body: { token },
        });
        setStatus("success");
        if (isAuthenticated) await refreshUser();
      } catch {
        setStatus("error");
      }
    })();
  }, [token, isAuthenticated, refreshUser]);

  useEffect(() => {
    if (!token && user?.is_email_verified) setStatus("success");
  }, [token, user]);

  const resend = useMutation({
    mutationFn: () => apiRequest("/api/auth/resend-verification/", { method: "POST" }),
    onSuccess: () => toast.success(t("auth.resent")),
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  if (status === "verifying") {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </span>
        <h1 className="font-display text-2xl font-bold">{t("auth.verifyTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.verifying")}</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold">{t("auth.verifyTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.verified")}</p>
        </div>
        <Button asChild size="lg" variant="gradient" className="w-full">
          <Link href={isAuthenticated ? "/dashboard" : "/login"}>
            {isAuthenticated ? t("nav.dashboard") : t("auth.signIn")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <XCircle className="h-8 w-8" />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-bold">{t("auth.verifyTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.verifyFailed")}</p>
      </div>
      <div className="space-y-2">
        {isAuthenticated && !user?.is_email_verified && (
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
          <Link href={isAuthenticated ? "/dashboard" : "/login"}>
            {isAuthenticated ? t("nav.dashboard") : t("auth.backToLogin")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

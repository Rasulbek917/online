"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePublicSettings } from "@/lib/queries";
import { getErrorMessage } from "@/lib/utils";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccounts {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (
      element: HTMLElement,
      options: {
        theme?: "outline" | "filled_blue" | "filled_black";
        size?: "large" | "medium" | "small";
        text?: "signin_with" | "signup_with" | "continue_with";
        shape?: "rectangular" | "pill" | "circle" | "square";
        width?: number;
        locale?: string;
      },
    ) => void;
  };
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccounts };
  }
}

const SCRIPT_ID = "google-identity-services";

export function GoogleButton({ next }: { next?: string | null }) {
  // The backend validates the ID token audience, so the browser must use the
  // exact same Web client ID. Reading it from the public settings endpoint
  // keeps both sides in sync instead of relying on two env files.
  const settings = usePublicSettings();
  // The backend is the runtime source of truth, but the settings request can
  // fail (cold start, database unavailable). Fall back to the build-time value
  // so the button does not silently disappear after the loading spinner.
  const clientId =
    settings.data?.google_client_id?.trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const { googleLogin } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response?.credential) return;
      setPending(true);
      try {
        const user = await googleLogin(response.credential);
        router.replace(next || dashboardPathFor(user.role));
      } catch (error) {
        toast.error(getErrorMessage(error, t("auth.googleError")));
      } finally {
        setPending(false);
      }
    },
    [googleLogin, next, router, t],
  );

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
      containerRef.current.innerHTML = "";
      const width = Math.max(240, Math.min(368, Math.floor(containerRef.current.clientWidth || 368)));
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width,
        locale: lang === "ru" ? "ru" : "uz",
      });
      setReady(true);
    };

    if (document.getElementById(SCRIPT_ID)) {
      render();
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => {
        if (!cancelled) toast.error(t("auth.googleError"));
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, handleCredential, lang, t]);

  if (!clientId && settings.isLoading) {
    return (
      <div className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background/60">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("auth.continueGoogle")}
        </span>
      </div>
    );
  }

  if (!clientId) return null;

  return (
    <div className="relative flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-background/60">
      {!ready && !pending && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("auth.continueGoogle")}
        </span>
      )}
      <div ref={containerRef} className="flex w-full justify-center [&>div]:!w-full" />
    </div>
  );
}

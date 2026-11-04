import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { AuthSkeleton } from "@/features/auth/auth-skeleton";

export const metadata: Metadata = {
  title: "Yangi parol",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

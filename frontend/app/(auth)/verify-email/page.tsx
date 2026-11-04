import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmailStatus } from "@/features/auth/verify-email-status";
import { AuthSkeleton } from "@/features/auth/auth-skeleton";

export const metadata: Metadata = {
  title: "Emailni tasdiqlash",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <VerifyEmailStatus />
    </Suspense>
  );
}

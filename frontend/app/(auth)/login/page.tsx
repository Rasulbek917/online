import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { AuthSkeleton } from "@/features/auth/auth-skeleton";

export const metadata: Metadata = {
  title: "Kirish",
  description: "IT PARK ACADEMY hisobingizga kirib, o'qishni davom ettiring.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

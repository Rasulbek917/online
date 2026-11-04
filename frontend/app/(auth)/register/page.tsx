import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/register-form";
import { AuthSkeleton } from "@/features/auth/auth-skeleton";

export const metadata: Metadata = {
  title: "Ro'yxatdan o'tish",
  description: "IT PARK ACADEMY'da bepul hisob yarating va o'qishni bugun boshlang.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}

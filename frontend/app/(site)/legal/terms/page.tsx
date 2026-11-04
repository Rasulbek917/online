import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "Foydalanish shartlari",
  description:
    "IT PARK ACADEMY foydalanish shartlari: hisob, to'lov, kontent va foydalanish qoidalari.",
  alternates: { canonical: "/legal/terms" },
};

export default function Page() {
  return <LegalPage kind="terms" />;
}

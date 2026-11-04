import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description:
    "IT PARK ACADEMY maxfiylik siyosati: qanday ma'lumotlar yig'iladi, qanday ishlatiladi va qanday himoyalanadi.",
  alternates: { canonical: "/legal/privacy" },
};

export default function Page() {
  return <LegalPage kind="privacy" />;
}

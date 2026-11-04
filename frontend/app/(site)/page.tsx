import type { Metadata } from "next";
import { HomePage } from "@/features/home/home-page";

export const metadata: Metadata = {
  title: "IT PARK ACADEMY — Zamonaviy IT ta'lim platformasi",
  description:
    "IT sohasini noldan o'rganing: amaliy video darslar, interaktiv testlar, oylik obuna va rasmiy sertifikatlar. O'zbek va rus tillarida.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomePage />;
}

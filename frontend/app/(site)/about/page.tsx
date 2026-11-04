import type { Metadata } from "next";
import { AboutPage } from "@/features/about/about-page";

export const metadata: Metadata = {
  title: "Biz haqimizda",
  description:
    "IT PARK ACADEMY — amaliy IT ta'limi, interaktiv testlar va xalqaro darajadagi sertifikatlar. Platforma, missiya va qadriyatlar bilan tanishing.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "IT PARK ACADEMY — Biz haqimizda",
    description: "Amaliy IT ta'limi, interaktiv testlar va tasdiqlanadigan sertifikatlar.",
    url: "/about",
  },
};

export default function Page() {
  return <AboutPage />;
}

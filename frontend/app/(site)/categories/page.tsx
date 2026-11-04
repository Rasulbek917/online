import type { Metadata } from "next";
import { CategoriesPage } from "@/features/categories/categories-page";

export const metadata: Metadata = {
  title: "Kategoriyalar",
  description: "IT PARK ACADEMY yo'nalishlari: dasturlash, Python, JavaScript, frontend, backend, UI/UX, dizayn, marketing.",
  alternates: { canonical: "/categories" },
};

export default function Page() {
  return <CategoriesPage />;
}

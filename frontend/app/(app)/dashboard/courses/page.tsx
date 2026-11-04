import type { Metadata } from "next";
import { MyCoursesPage } from "@/features/dashboard/my-courses-page";

export const metadata: Metadata = {
  title: "Mening kurslarim",
  robots: { index: false, follow: false },
};

export default function DashboardCoursesPage() {
  return <MyCoursesPage />;
}

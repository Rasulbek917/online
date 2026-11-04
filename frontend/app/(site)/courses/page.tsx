import { Suspense } from "react";
import type { Metadata } from "next";
import { CoursesPage } from "@/features/courses/courses-page";
import { CourseCardSkeleton } from "@/components/shared/course-card";

export const metadata: Metadata = {
  title: "Kurslar katalogi",
  description:
    "IT PARK ACADEMY kurslari: dasturlash, Python, JavaScript, frontend, backend, UI/UX, dizayn, marketing va mobil dasturlash.",
  alternates: { canonical: "/courses" },
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="container py-14">
          <div className="skeleton mb-8 h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        </div>
      }
    >
      <CoursesPage />
    </Suspense>
  );
}

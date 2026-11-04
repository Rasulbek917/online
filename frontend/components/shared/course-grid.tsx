import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCard, CourseCardSkeleton } from "./course-card";

export function CourseGrid({
  courses,
  loading,
  skeletonCount = 6,
  className,
}: {
  courses?: Course[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5", className)}>
      {loading
        ? Array.from({ length: skeletonCount }).map((_, index) => <CourseCardSkeleton key={index} />)
        : courses?.map((course) => <CourseCard key={course.id} course={course} />)}
    </div>
  );
}

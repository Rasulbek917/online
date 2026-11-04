import { CourseEditorPage } from "@/features/portal/course-editor-page";

export default async function TeacherCourseEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CourseEditorPage role="teacher" slug={slug} />;
}

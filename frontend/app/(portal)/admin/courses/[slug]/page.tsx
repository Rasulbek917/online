import { CourseEditorPage } from "@/features/portal/course-editor-page";

export default async function AdminCourseEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CourseEditorPage role="admin" slug={slug} />;
}

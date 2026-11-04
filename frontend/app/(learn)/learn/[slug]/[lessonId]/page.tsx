import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearnPage } from "@/features/learn/learn-page";

export const metadata: Metadata = {
  title: "Dars",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const id = Number(lessonId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <LearnPage slug={slug} lessonId={id} />;
}

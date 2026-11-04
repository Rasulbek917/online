import type { Metadata } from "next";
import { CategoryPage } from "@/features/categories/category-page";
import { SERVER_API_URL } from "@/lib/server-api";

interface CategoryMeta {
  name_uz: string;
  name_ru: string;
  description_uz: string;
  description_ru: string;
}

async function getCategory(slug: string): Promise<CategoryMeta | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}/api/categories/${slug}/?lang=uz`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as CategoryMeta;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  const title = category ? `${category.name_uz} kurslari` : "Kategoriya";
  return {
    title,
    description: category?.description_uz || `IT PARK ACADEMY — ${title}`,
    alternates: { canonical: `/categories/${slug}` },
  };
}

export default function Page() {
  return <CategoryPage />;
}

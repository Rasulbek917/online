import type { MetadataRoute } from "next";
import { SERVER_API_URL, SITE_URL } from "@/lib/server-api";

interface SitemapCourse {
  slug: string;
  published_at: string | null;
}

interface SitemapCategory {
  slug: string;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}${path}`, { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/courses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/verify/certificate`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/legal/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const [courses, categories] = await Promise.all([
    getJson<{ results: SitemapCourse[] }>("/api/courses/?lang=uz&page_size=500"),
    getJson<{ results: SitemapCategory[] }>("/api/categories/?lang=uz&page_size=200"),
  ]);

  const courseRoutes: MetadataRoute.Sitemap = (courses?.results || []).map((course) => ({
    url: `${SITE_URL}/courses/${course.slug}`,
    lastModified: course.published_at || undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = (categories?.results || []).map((category) => ({
    url: `${SITE_URL}/categories/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...courseRoutes];
}

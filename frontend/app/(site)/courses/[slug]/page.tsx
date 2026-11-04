import type { Metadata } from "next";
import { CourseDetailPage } from "@/features/courses/course-detail";
import { SITE_URL, SERVER_API_URL, publicMediaUrl } from "@/lib/server-api";

interface CourseMeta {
  id: number;
  slug: string;
  title_uz: string;
  title_ru: string;
  short_description_uz: string;
  short_description_ru: string;
  thumbnail: string | null;
  level: string;
  language: string;
  is_free: boolean;
  effective_price: string;
  rating_avg: string;
  rating_count: number;
  lessons_count: number;
  teacher: { full_name: string };
}

async function getCourse(slug: string): Promise<CourseMeta | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}/api/courses/${slug}/?lang=uz`, {
      next: { revalidate: 120 },
    });
    if (!response.ok) return null;
    return (await response.json()) as CourseMeta;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) {
    return { title: "Kurs", alternates: { canonical: `/courses/${slug}` } };
  }

  const title = course.title_uz;
  const description = course.short_description_uz || `IT PARK ACADEMY — ${title}`;
  const image = course.thumbnail ? publicMediaUrl(course.thumbnail) : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/courses/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/courses/${slug}`,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  const jsonLd = course
    ? {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.title_uz,
        description: course.short_description_uz,
        inLanguage: course.language === "ru" ? "ru" : "uz",
        provider: {
          "@type": "Organization",
          name: "IT PARK ACADEMY",
          sameAs: SITE_URL,
        },
        instructor: {
          "@type": "Person",
          name: course.teacher?.full_name,
        },
        aggregateRating:
          course.rating_count > 0
            ? {
                "@type": "AggregateRating",
                ratingValue: Number(course.rating_avg).toFixed(1),
                reviewCount: course.rating_count,
              }
            : undefined,
        offers: {
          "@type": "Offer",
          price: course.is_free ? "0" : course.effective_price,
          priceCurrency: "UZS",
          availability: "https://schema.org/InStock",
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <CourseDetailPage slug={slug} />
    </>
  );
}

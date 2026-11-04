import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IT PARK ACADEMY — Zamonaviy IT ta'lim platformasi",
    template: "%s | IT PARK ACADEMY",
  },
  description:
    "IT PARK ACADEMY — video darslar, interaktiv testlar va rasmiy sertifikatlar bilan IT sohasini amaliy o'rganish platformasi.",
  keywords: [
    "IT Park Academy",
    "onlayn kurslar",
    "dasturlash kurslari",
    "Python",
    "JavaScript",
    "UI UX",
    "sertifikat",
    "Toshkent",
  ],
  authors: [{ name: "IT PARK ACADEMY" }],
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    alternateLocale: ["ru_RU"],
    url: siteUrl,
    siteName: "IT PARK ACADEMY",
    title: "IT PARK ACADEMY — Zamonaviy IT ta'lim platformasi",
    description:
      "Video darslar, interaktiv testlar va rasmiy sertifikatlar bilan IT sohasini noldan o'rganing.",
  },
  twitter: {
    card: "summary_large_image",
    title: "IT PARK ACADEMY",
    description: "Amaliy IT ta'limi, testlar va rasmiy sertifikatlar.",
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
    languages: { uz: "/", ru: "/?lang=ru" },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className={`${inter.variable} ${display.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

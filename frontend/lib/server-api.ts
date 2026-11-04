const normalise = (value: string) => value.replace(/\/$/, "");

/** Server-side API origin used by metadata, sitemap and server renders. */
export const SERVER_API_URL = normalise(
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
);

const vercelPublicHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";

export const SITE_URL = normalise(
  process.env.NEXT_PUBLIC_SITE_URL ||
    (vercelPublicHost ? `https://${vercelPublicHost}` : "http://localhost:3000"),
);

/** Convert a backend media URL into a public, same-site URL. */
export function publicMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) {
    try {
      const parsed = new URL(url);
      if (["localhost", "127.0.0.1", "backend"].includes(parsed.hostname)) {
        return `${SITE_URL}${parsed.pathname}${parsed.search}`;
      }
      return url;
    } catch {
      return url;
    }
  }
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

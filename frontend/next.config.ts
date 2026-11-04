import type { NextConfig } from "next";

// Empty NEXT_PUBLIC_API_URL means same-origin requests. In that mode Next.js
// proxies /api and /media to INTERNAL_API_URL so the HttpOnly refresh cookie
// stays on the same site even when Django runs in a separate container.
const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const internalApiUrl = (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "backend", port: "8000" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    if (publicApiUrl) return [];
    return [
      { source: "/api/:path*", destination: `${internalApiUrl}/api/:path*` },
      { source: "/media/:path*", destination: `${internalApiUrl}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Public Islamic site: static files in /public, served through rewrites.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src https://server8.mp3quran.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const toHome = [
  "/pricing",
  "/plans",
  "/upgrade",
  "/advertise",
  "/about",
  "/videos",
  "/news",
  "/search",
  "/challenges",
  "/challenges/:path*",
  "/projects",
  "/projects/:path*",
  "/profile/:path*",
  "/friends",
  "/account",
  "/admin",
  "/admin/:path*",
  "/moderation",
  "/moderation/:path*",
  "/posts",
];

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      ...toHome.map((source) => ({ source, destination: "/", statusCode: 301 })),
      { source: "/terms", destination: "/privacy", statusCode: 301 },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/sources", destination: "/sources.html" },
        { source: "/privacy", destination: "/privacy.html" },
        { source: "/sheikhs", destination: "/sheikhs.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    const security = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
    ];
    const pages = ["/", "/sources", "/privacy", "/sheikhs", "/index.html", "/sources.html", "/privacy.html", "/sheikhs.html"];
    return [
      ...pages.map((source) => ({ source, headers: security })),
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }] },
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};
export default config;

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
    const pages = ["/", "/sources", "/privacy", "/index.html", "/sources.html", "/privacy.html", "/sheikhs.html"];
    const nextPublicCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src https://server8.mp3quran.net",
      "frame-src https://www.youtube-nocookie.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    const staffCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      ...pages.map((source) => ({ source, headers: security })),
      { source: "/sheikhs", headers: [{ key: "Content-Security-Policy", value: nextPublicCsp }, ...security.slice(1)] },
      { source: "/sheikhs/:path*", headers: [{ key: "Content-Security-Policy", value: nextPublicCsp }, ...security.slice(1)] },
      ...["/login", "/login/:path*", "/admin", "/admin/:path*", "/sheikh", "/sheikh/:path*", "/student", "/student/:path*", "/auth/:path*"].map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: staffCsp }, ...security.slice(1)],
      })),
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }] },
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};
export default config;

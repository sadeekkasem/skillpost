import type { NextConfig } from "next";

const staticCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://www.mp3quran.net",
  "media-src https://cdn.mp3quran.net https://everyayah.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextPublicCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://www.mp3quran.net",
  "media-src https://cdn.mp3quran.net https://everyayah.com",
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
  "/feed",
  "/messages",
  "/chat",
  "/notifications",
  "/settings",
  "/dashboard",
  "/u/:path*",
];

const securityBase = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      ...toHome.map((source) => ({ source, destination: "/", statusCode: 301 })),
      { source: "/terms", destination: "/privacy", statusCode: 301 },
      { source: "/sheikhs.html", destination: "/sheikhs", statusCode: 301 },
      { source: "/hadith.html", destination: "/hadith", statusCode: 301 },
      { source: "/salawat.html", destination: "/salawat", statusCode: 301 },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/sources", destination: "/sources.html" },
        { source: "/hadith", destination: "/hadith.html" },
        { source: "/salawat", destination: "/salawat.html" },
        { source: "/privacy", destination: "/privacy.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityBase, { key: "Content-Security-Policy", value: staticCsp }],
      },
      {
        source: "/",
        headers: [...securityBase, { key: "Content-Security-Policy", value: staticCsp }],
      },
      {
        source: "/sheikhs",
        headers: [...securityBase, { key: "Content-Security-Policy", value: nextPublicCsp }],
      },
      {
        source: "/sheikhs/:path*",
        headers: [...securityBase, { key: "Content-Security-Policy", value: nextPublicCsp }],
      },
      ...["/login", "/login/:path*", "/admin", "/admin/:path*", "/sheikh", "/sheikh/:path*", "/student", "/student/:path*", "/auth/:path*"].map((source) => ({
        source,
        headers: [...securityBase, { key: "Content-Security-Policy", value: staffCsp }],
      })),
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }] },
      { source: "/hero-image", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/style.css", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/ayah-timings.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
        { source: "/app.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/menu.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/analytics.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/site-content.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/praytimes.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/hadith.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/hadith-core.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/salawat.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/salawat-core.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
      { source: "/yt-facade.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }] },
    ];
  },
};
export default config;

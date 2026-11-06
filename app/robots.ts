import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/moderation", "/account", "/api"] },
    sitemap: "https://skillpostapp.com/sitemap.xml",
  };
}

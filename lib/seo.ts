/** Shared SEO helpers. Canonical host is always www. */
export const SITE_URL = "https://www.skillpostapp.com";

/** Clip plain text for meta description (target ~140–160 chars). */
export function clipMetaDescription(text: string, max = 160): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

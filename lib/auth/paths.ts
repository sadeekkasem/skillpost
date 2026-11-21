const allowedExact = new Set(["/login", "/admin", "/sheikh", "/student", "/hifz"]);
const allowedPrefixes = ["/admin/", "/sheikh/", "/student/", "/hifz/"];

export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return null;
  }
  const path = raw.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (allowedExact.has(path) || allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return path;
  }
  return null;
}

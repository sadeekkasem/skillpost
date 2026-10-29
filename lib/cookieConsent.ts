export const COOKIE_CONSENT_KEY = "cookie_consent";
export type CookieConsent = "accepted" | "rejected";

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: CookieConsent): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // Storage unavailable: the banner will simply show again next visit.
  }
}

/** True only if the user explicitly accepted optional (stats/ads) cookies. */
export function hasAdCookieConsent(): boolean {
  return getCookieConsent() === "accepted";
}
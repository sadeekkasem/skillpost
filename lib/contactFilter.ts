// Blocks sharing phone numbers, emails, links and outside messaging apps in chat.
// Mirrors public.message_has_contact() in supabase/migration_2026-10-30_chat_contact_filter.sql.

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeDigits(text: string) {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(d));
  });
}

const EMAIL = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(\.|dot)\s*[a-z]{2,}/i;
const LINK =
  /(https?:\/\/|www\.|wa\.me|t\.me|[a-z0-9-]+\.(com|net|org|fi|io|me|co|info|biz|app|dev|site|store|shop)(?![a-z]))/i;
const APPS =
  /(whats\s*app|واتس|telegram|تلغرام|تليغرام|تيليجرام|تلجرام|viber|فايبر|signal|سيغنال|gmail|hotmail|outlook|yahoo)/i;

export function hasContactInfo(text: string): boolean {
  const t = normalizeDigits(text);
  if (/\d{7,}/.test(t.replace(/[\s\-.()+/_]/g, ""))) return true;
  return EMAIL.test(t) || LINK.test(t) || APPS.test(t);
}

export const CONTACT_BLOCKED_MESSAGE =
  "لحمايتك، لا يُسمح بمشاركة أرقام الهاتف أو البريد أو الروابط أو تطبيقات التواصل الخارجية في الدردشة.";

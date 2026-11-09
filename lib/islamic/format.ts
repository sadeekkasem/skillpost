const kyiv = new Intl.DateTimeFormat("ar", {
  timeZone: "Europe/Kiev",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatKyiv(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${kyiv.format(date)} بتوقيت كييف`;
}

export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create_sheikh: "إضافة صفحة",
    set_sheikh_status: "تغيير حالة الصفحة",
    set_lesson_status: "تغيير حالة المقطع",
    invite: "دعوة",
    revoke: "إلغاء دعوة",
    accept: "قبول دعوة",
    update_page: "تعديل الصفحة",
    add_lesson: "إضافة مقطع",
    update_lesson: "تعديل مقطع",
    upsert_site_content: "تعديل نص أو صورة الموقع",
  };
  return map[action] ?? action;
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "مدير",
    sheikh: "شيخ",
    student: "مساعد",
  };
  return map[role] ?? role;
}

import { redirect } from "next/navigation";
import { ActionForm } from "../components/ActionForm";
import { StaffShell } from "../components/StaffShell";
import {
  adminCreateSheikh,
  adminSetLessonStatus,
  adminSetSheikhStatus,
  inviteStaff,
  revokeInvitation,
  saveSiteContent,
  uploadHeroImage,
} from "../../lib/islamic/actions";
import { loadAdminExtras } from "../../lib/islamic/admin-data";
import { actionLabel, formatKyiv, roleLabel } from "../../lib/islamic/format";
import { fixturesEnabled } from "../../lib/supabase/env";
import { loadWorkspace } from "../../lib/islamic/workspace";

export const dynamic = "force-dynamic";

const CONTENT_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "hero_eyebrow", label: "سطر الترويسة" },
  { key: "hero_title", label: "عنوان الرئيسية", multiline: true },
  { key: "hero_lead", label: "الفقرة التعريفية", multiline: true },
  { key: "hero_image_alt", label: "النص البديل للصورة" },
  { key: "hero_caption_place", label: "سطر المكان تحت الصورة" },
  { key: "hero_caption_title", label: "عنوان الصورة" },
  { key: "hero_caption_credit", label: "نسبة الصورة" },
];

export default async function AdminPage() {
  const workspace = await loadWorkspace();
  if (!fixturesEnabled() && workspace.role !== "admin") {
    if (!workspace.role) redirect("/login");
    if (workspace.role === "sheikh") redirect("/sheikh");
    if (workspace.role === "student") redirect("/student");
  }
  const extras = await loadAdminExtras();
  const sheikhs = workspace.sheikhs ?? [];
  const maxViews = Math.max(1, ...extras.stats.daily.map((d) => d.views), ...extras.stats.paths.map((p) => p.views));
  const contentMap = Object.fromEntries(extras.siteContent.map((item) => [item.key, item]));

  return (
    <StaffShell title="لوحة الإدارة" eyebrow="حساب المدير">
      <nav className="staff-subnav" aria-label="أقسام اللوحة">
        <a href="#admin-pages">الصفحات</a>
        <a href="#admin-lessons">المقاطع</a>
        <a href="#admin-invites">الدعوات</a>
        <a href="#admin-audit">سجل النشاط</a>
        <a href="#admin-stats">الزوار</a>
        <a href="#admin-content">النصوص والصورة</a>
        <a href="#admin-accounts">الحسابات</a>
      </nav>

      <article className="card source-card" id="admin-create">
        <h2>إضافة صفحة</h2>
        <ActionForm action={adminCreateSheikh} className="staff-form">
          <label>
            الاسم
            <input name="name" required maxLength={120} />
          </label>
          <label>
            البريد الخاص
            <input name="email" type="email" required dir="ltr" />
          </label>
          <label>
            رابط القناة (اختياري)
            <input name="channel" dir="ltr" placeholder="https://www.youtube.com/@..." />
          </label>
          <button className="button" type="submit">إضافة وإعداد الدعوة</button>
        </ActionForm>
      </article>

      <article className="card source-card" id="admin-pages">
        <h2>الصفحات</h2>
        <ul className="staff-list">
          {sheikhs.map((sheikh) => (
            <li key={sheikh.id}>
              <strong>{sheikh.name}</strong>
              <p className="mini-label">{sheikh.email ?? ""} · {sheikh.status} · {sheikh.slug}</p>
              {sheikh.youtube_channel_url ? <p className="mini-label" dir="ltr">{sheikh.youtube_channel_url}</p> : null}
              <div className="staff-actions">
                <ActionForm action={adminSetSheikhStatus}>
                  <input type="hidden" name="sheikh_id" value={sheikh.id} />
                  <input type="hidden" name="status" value="published" />
                  <button className="button" type="submit">نشر</button>
                </ActionForm>
                <ActionForm action={adminSetSheikhStatus}>
                  <input type="hidden" name="sheikh_id" value={sheikh.id} />
                  <input type="hidden" name="status" value="hidden" />
                  <button className="button secondary" type="submit">إخفاء</button>
                </ActionForm>
              </div>
              <ActionForm action={inviteStaff} className="staff-form">
                <input type="hidden" name="sheikh_id" value={sheikh.id} />
                <input type="hidden" name="role" value="sheikh" />
                <label>
                  إعادة الدعوة إلى بريد
                  <input name="email" type="email" required dir="ltr" />
                </label>
                <button className="button" type="submit">إرسال دعوة</button>
              </ActionForm>
            </li>
          ))}
        </ul>
        {sheikhs.length === 0 ? <p>لا صفحات بعد.</p> : null}
      </article>

      <article className="card source-card" id="admin-lessons">
        <h2>المقاطع</h2>
        <ul className="staff-list">
          {workspace.lessons.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p className="mini-label">{item.status} · {item.youtube_video_id}</p>
              <div className="staff-actions">
                <ActionForm action={adminSetLessonStatus}>
                  <input type="hidden" name="lesson_id" value={item.id} />
                  <input type="hidden" name="status" value="published" />
                  <button className="button" type="submit">نشر</button>
                </ActionForm>
                <ActionForm action={adminSetLessonStatus}>
                  <input type="hidden" name="lesson_id" value={item.id} />
                  <input type="hidden" name="status" value="hidden" />
                  <button className="button secondary" type="submit">إخفاء</button>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
        {workspace.lessons.length === 0 ? <p>لا مقاطع بعد.</p> : null}
      </article>

      <article className="card source-card" id="admin-invites">
        <h2>الدعوات</h2>
        <ul className="staff-list">
          {workspace.invitations.map((item) => (
            <li key={item.id}>
              <span dir="ltr">{item.email}</span>
              <p className="mini-label">{item.role} · ينتهي {item.expires_at}{item.revoked_at ? " · ملغاة" : ""}{item.accepted_at ? " · مقبولة" : ""}</p>
              {!item.revoked_at && !item.accepted_at ? (
                <ActionForm action={revokeInvitation}>
                  <input type="hidden" name="invitation_id" value={item.id} />
                  <button className="button secondary" type="submit">إلغاء الدعوة</button>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
        {workspace.invitations.length === 0 ? <p>لا دعوات.</p> : null}
      </article>

      <article className="card source-card" id="admin-audit">
        <h2>سجل النشاط</h2>
        <p className="mini-label">عرض فقط: من أضاف أو عدّل صفحة أو مقطعًا أو دعوة أو حالة نشر، ومتى.</p>
        <ul className="staff-list">
          {extras.audit.map((item) => (
            <li key={item.id}>
              <strong>{actionLabel(item.action)}</strong>
              <p className="mini-label" dir="ltr">{item.actor_email || "—"}</p>
              <p className="mini-label">{item.entity_type}{item.entity_id ? ` · ${item.entity_id}` : ""}</p>
              <p className="mini-label">{formatKyiv(item.created_at)}</p>
            </li>
          ))}
        </ul>
        {extras.audit.length === 0 ? <p>لا أحداث بعد.</p> : null}
      </article>

      <article className="card source-card" id="admin-stats">
        <h2>إحصاءات الزوار</h2>
        <p className="mini-label">{extras.stats.note}</p>
        <p className="mini-label">المصدر: {extras.stats.source === "vercel" ? "Vercel Web Analytics" : extras.stats.source === "fixtures" ? "بيانات اختبار وهمية" : "عدادات بلا كوكيز"}</p>
        <h3>حسب اليوم</h3>
        {extras.stats.daily.length === 0 ? <p>لا أرقام بعد.</p> : (
          <ul className="staff-chart">
            {extras.stats.daily.map((point) => (
              <li key={point.day}>
                <span>{point.day}</span>
                <i style={{ width: `${Math.max(8, (point.views / maxViews) * 100)}%` }} />
                <b>{point.views}{point.visitors != null ? ` / ${point.visitors}` : ""}</b>
              </li>
            ))}
          </ul>
        )}
        <h3>حسب المسار</h3>
        {extras.stats.paths.length === 0 ? <p>لا مسارات بعد.</p> : (
          <ul className="staff-chart">
            {extras.stats.paths.map((point) => (
              <li key={point.path}>
                <span dir="ltr">{point.path}</span>
                <i style={{ width: `${Math.max(8, (point.views / maxViews) * 100)}%` }} />
                <b>{point.views}</b>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="card source-card" id="admin-content">
        <h2>نصوص الموقع وصورة الرئيسية</h2>
        <p className="mini-label">تظهر النصوص المنشورة على الصفحة الأولى. لا تُدرج نصوصًا دينية غير موجودة أصلًا في الموقع.</p>
        <ActionForm action={saveSiteContent} className="staff-form">
          {CONTENT_FIELDS.map((field) => {
            const current = contentMap[field.key];
            return (
              <label key={field.key}>
                {field.label}
                {field.multiline ? (
                  <textarea name={field.key} rows={3} maxLength={2000} defaultValue={current?.value ?? ""} />
                ) : (
                  <input name={field.key} maxLength={2000} defaultValue={current?.value ?? ""} />
                )}
                <input type="hidden" name={`${field.key}_published`} value={current && current.published === false ? "false" : "true"} />
              </label>
            );
          })}
          <button className="button" type="submit">حفظ النصوص</button>
        </ActionForm>
        <ActionForm action={uploadHeroImage} className="staff-form">
          <label>
            صورة الرئيسية (WebP حتى 512 كيلوبايت)
            <input name="hero" type="file" accept="image/webp" />
          </label>
          <p className="mini-label">الصورة الحالية: {contentMap.hero_image_url?.value || "/img/kaaba-800.webp"}</p>
          <button className="button" type="submit">رفع الصورة</button>
        </ActionForm>
      </article>

      <article className="card source-card" id="admin-accounts">
        <h2>الحسابات والأدوار</h2>
        <p className="mini-label">عرض فقط. لا حذف ولا حظر ولا تعديل من هنا.</p>
        <ul className="staff-list">
          {extras.accounts.map((item, index) => (
            <li key={`${item.email}-${item.role}-${index}`}>
              <strong dir="ltr">{item.email}</strong>
              <p className="mini-label">{roleLabel(item.role)}</p>
              <p className="mini-label">أُنشئ: {formatKyiv(item.created_at)}</p>
              <p className="mini-label">آخر دخول: {formatKyiv(item.last_sign_in_at)}</p>
            </li>
          ))}
        </ul>
        {extras.accounts.length === 0 ? <p>لا حسابات ظاهرة.</p> : null}
      </article>
    </StaffShell>
  );
}

import { redirect } from "next/navigation";
import { ActionForm } from "../components/ActionForm";
import { StaffShell } from "../components/StaffShell";
import { addLesson, inviteStaff, revokeInvitation, updateLesson, updateSheikhPage } from "../../lib/islamic/actions";
import { fixturesEnabled } from "../../lib/supabase/env";
import { loadWorkspace } from "../../lib/islamic/workspace";

export const dynamic = "force-dynamic";

export default async function SheikhPage() {
  const workspace = await loadWorkspace();
  if (!fixturesEnabled() && workspace.role !== "sheikh") {
    if (workspace.role === "admin") redirect("/admin");
    if (workspace.role === "student") redirect("/student");
    redirect("/login");
  }
  const sheikh = workspace.sheikh ?? workspace.sheikhs?.[0];
  if (!sheikh) {
    return (
      <StaffShell title="صفحتك" eyebrow="حساب الشيخ">
        <p>لا صفحة مرتبطة بهذا الحساب بعد. إن وصلت بدعوة فجرّب الدخول مرة أخرى.</p>
      </StaffShell>
    );
  }
  return (
    <StaffShell title={sheikh.name} eyebrow="حساب الشيخ">
      <article className="card source-card">
        <h2>تعديل الصفحة</h2>
        <p className="mini-label">حالة النشر يحددها المدير فقط ({sheikh.status}).</p>
        <ActionForm action={updateSheikhPage} className="staff-form">
          <input type="hidden" name="sheikh_id" value={sheikh.id} />
          <label>
            الاسم
            <input name="name" required defaultValue={sheikh.name} maxLength={120} />
          </label>
          <label>
            رابط القناة
            <input name="channel" dir="ltr" defaultValue={sheikh.youtube_channel_url ?? ""} />
          </label>
          <button className="button" type="submit">حفظ</button>
        </ActionForm>
      </article>

      <article className="card source-card">
        <h2>إضافة مقطع</h2>
        <ActionForm action={addLesson} className="staff-form">
          <input type="hidden" name="sheikh_id" value={sheikh.id} />
          <label>
            العنوان
            <input name="title" required maxLength={160} />
          </label>
          <label>
            رابط الفيديو
            <input name="video" required dir="ltr" placeholder="https://www.youtube.com/watch?v=..." />
          </label>
          <button className="button" type="submit">إضافة كمسودة</button>
        </ActionForm>
      </article>

      <article className="card source-card">
        <h2>المقاطع</h2>
        <ul className="staff-list">
          {workspace.lessons.map((item) => (
            <li key={item.id}>
              <ActionForm action={updateLesson} className="staff-form">
                <input type="hidden" name="lesson_id" value={item.id} />
                <label>
                  العنوان
                  <input name="title" required defaultValue={item.title} />
                </label>
                <label>
                  رابط أو معرّف الفيديو
                  <input name="video" required dir="ltr" defaultValue={`https://www.youtube.com/watch?v=${item.youtube_video_id}`} />
                </label>
                <p className="mini-label">الحالة: {item.status} (لا يمكنك تغييرها)</p>
                <button className="button" type="submit">حفظ</button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </article>

      <article className="card source-card">
        <h2>دعوة مساعد واحد</h2>
        <ActionForm action={inviteStaff} className="staff-form">
          <input type="hidden" name="sheikh_id" value={sheikh.id} />
          <input type="hidden" name="role" value="student" />
          <label>
            البريد
            <input name="email" type="email" required dir="ltr" />
          </label>
          <button className="button" type="submit">دعوة</button>
        </ActionForm>
        <ul className="staff-list">
          {workspace.invitations.map((item) => (
            <li key={item.id}>
              <span dir="ltr">{item.email}</span>
              <p className="mini-label">{item.accepted_at ? "مقبولة" : item.revoked_at ? "ملغاة" : "قيد الانتظار"}</p>
              {!item.accepted_at && !item.revoked_at ? (
                <ActionForm action={revokeInvitation}>
                  <input type="hidden" name="invitation_id" value={item.id} />
                  <button className="button secondary" type="submit">إلغاء</button>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      </article>
    </StaffShell>
  );
}

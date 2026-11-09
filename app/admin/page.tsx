import { redirect } from "next/navigation";
import { ActionForm } from "../components/ActionForm";
import { StaffShell } from "../components/StaffShell";
import {
  adminCreateSheikh,
  adminSetLessonStatus,
  adminSetSheikhStatus,
  inviteStaff,
  revokeInvitation,
} from "../../lib/islamic/actions";
import { fixturesEnabled } from "../../lib/supabase/env";
import { loadWorkspace } from "../../lib/islamic/workspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const workspace = await loadWorkspace();
  if (!fixturesEnabled() && workspace.role !== "admin") {
    if (!workspace.role) redirect("/login");
    if (workspace.role === "sheikh") redirect("/sheikh");
    if (workspace.role === "student") redirect("/student");
  }
  const sheikhs = workspace.sheikhs ?? [];
  return (
    <StaffShell title="لوحة الإدارة" eyebrow="حساب المدير">
      <article className="card source-card">
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

      <article className="card source-card">
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

      <article className="card source-card">
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

      <article className="card source-card">
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
    </StaffShell>
  );
}

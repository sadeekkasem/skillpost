import { redirect } from "next/navigation";
import { ActionForm } from "../components/ActionForm";
import { StaffShell } from "../components/StaffShell";
import { addLesson, updateLesson, updateSheikhPage } from "../../lib/islamic/actions";
import { fixturesEnabled } from "../../lib/supabase/env";
import { loadWorkspace } from "../../lib/islamic/workspace";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const workspace = await loadWorkspace();
  if (!fixturesEnabled() && workspace.role !== "student") {
    if (workspace.role === "admin") redirect("/admin");
    if (workspace.role === "sheikh") redirect("/sheikh");
    redirect("/login");
  }
  const sheikh = workspace.sheikh ?? workspace.sheikhs?.[0];
  if (!sheikh) {
    return (
      <StaffShell title="المساعدة" eyebrow="حساب المساعد">
        <p>لا صفحة مرتبطة بهذا الحساب بعد.</p>
      </StaffShell>
    );
  }
  return (
    <StaffShell title={`مساعدة: ${sheikh.name}`} eyebrow="حساب المساعد">
      <article className="card source-card">
        <h2>تعديل الصفحة</h2>
        <p className="mini-label">لا يمكنك تغيير حالة النشر ({sheikh.status}).</p>
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
            <input name="video" required dir="ltr" />
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
                  رابط الفيديو
                  <input name="video" required dir="ltr" defaultValue={`https://www.youtube.com/watch?v=${item.youtube_video_id}`} />
                </label>
                <p className="mini-label">الحالة: {item.status}</p>
                <button className="button" type="submit">حفظ</button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </article>
    </StaffShell>
  );
}

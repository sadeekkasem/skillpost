import type { ReactNode } from "react";
import { fixturesEnabled } from "../../lib/supabase/env";

export function StaffShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">تخطَّ إلى المحتوى</a>
      <header>
        <a className="brand" href="/#home" aria-label="نور الإسلام، الرئيسية">
          <span className="brand-icon" aria-hidden="true">✧</span>
          <span>نور الإسلام<small>القرآن والذكر</small></span>
        </a>
        <nav id="staff-nav" aria-label="تنقل العاملين">
          <a href="/">الموقع</a>
          <a href="/admin">الإدارة</a>
          <a href="/sheikh">الصفحة</a>
          <a href="/student">المساعدة</a>
        </nav>
      </header>
      <main id="main" className="static-page">
        {fixturesEnabled() ? (
          <p className="staff-banner">وضع اختبار محلي — البيانات المعروضة وهمية وليست حسابات حقيقية.</p>
        ) : null}
        <div className="page-top">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {children}
        <form action="/auth/signout" method="post" style={{ marginTop: 24 }}>
          <button className="button secondary" type="submit">تسجيل الخروج</button>
        </form>
      </main>
    </>
  );
}

import { SiteChrome } from "../components/SiteChrome";
import { ActionForm } from "../components/ActionForm";
import { requestMagicLink } from "../../lib/islamic/actions";
import { authConfigured, fixturesEnabled } from "../../lib/supabase/env";

export default function LoginPage() {
  const ready = authConfigured() || fixturesEnabled();
  return (
    <SiteChrome current="login">
      <div className="static-page">
        <div className="page-top">
          <span className="eyebrow">للعاملين فقط</span>
          <h1>تسجيل الدخول</h1>
          <p>يُرسل رابط الدخول إلى البريد. الزوار لا يحتاجون حسابًا.</p>
        </div>
        <article className="card source-card">
          {!ready ? (
            <p>الدخول غير مضبوط في هذا البناء بعد.</p>
          ) : (
            <ActionForm action={requestMagicLink} className="staff-form">
              <label>
                البريد الإلكتروني
                <input type="email" name="email" required autoComplete="email" dir="ltr" />
              </label>
              <button className="button" type="submit">أرسل رابط الدخول</button>
            </ActionForm>
          )}
        </article>
      </div>
    </SiteChrome>
  );
}

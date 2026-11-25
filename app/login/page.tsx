import { SiteChrome } from "../components/SiteChrome";
import { ActionForm } from "../components/ActionForm";
import { requestMagicLink } from "../../lib/islamic/actions";
import { authConfigured, fixturesEnabled } from "../../lib/supabase/env";

const REASONS: Record<string, string> = {
  browser: "افتح رابط الدخول في نفس المتصفح ونفس الجهاز الذي طلبته منه. إذا فتحته من تطبيق البريد على الهاتف، انسخ الرابط والصقه في المتصفح نفسه، أو اطلب رابطًا جديدًا من الجهاز الذي ستفتح عليه البريد.",
  expired: "رابط الدخول منتهي الصلاحية أو استُخدم من قبل. اطلب رابطًا جديدًا واستخدمه خلال ساعة، مرة واحدة فقط.",
  missing: "الرابط ناقص. اطلب رابطًا جديدًا.",
  config: "الدخول غير مضبوط في هذا البناء.",
  norole: "تم تسجيل دخولك، لكن بريدك غير مسجّل كمدير أو شيخ أو طالب في الموقع. تأكد أنك تستخدم البريد المسجّل في جدول المديرين.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const reasonKey = typeof params.e === "string" ? params.e : "";
  const reason = REASONS[reasonKey];
  const next = typeof params.next === "string" ? params.next : "";
  const ready = authConfigured() || fixturesEnabled();
  return (
    <SiteChrome current="login">
      <div className="static-page">
        <div className="page-top">
          <span className="eyebrow">للعاملين فقط</span>
          <h1>تسجيل الدخول</h1>
          <p>هذه الصفحة للعاملين في الموقع فقط. يُرسل رابط الدخول إلى البريد. زوار رفيق الحفظ ينشئون حسابهم من صفحة <a href="/hifz">رفيق الحفظ</a>.</p>
        </div>
        {reason ? <p className="disclaimer" role="alert">{reason}</p> : null}
        <article className="card source-card">
          {!ready ? (
            <p>الدخول غير مضبوط في هذا البناء بعد.</p>
          ) : (
            <ActionForm action={requestMagicLink} className="staff-form">
              <label>
                البريد الإلكتروني
                <input type="email" name="email" required autoComplete="email" dir="ltr" />
              </label>
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <button className="button" type="submit">أرسل رابط الدخول</button>
              <p className="mini-label">افتح الرابط الذي يصلك في نفس هذا المتصفح وعلى نفس الجهاز.</p>
            </ActionForm>
          )}
        </article>
      </div>
    </SiteChrome>
  );
}

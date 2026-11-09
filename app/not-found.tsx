export default function NotFound() {
  return (
    <>
      <header>
        <a className="brand" href="/#home" aria-label="سكل بوست، الرئيسية">
          <span className="brand-icon" aria-hidden="true">✧</span>
          <span>سِكِل بوست<small>القرآن والذكر</small></span>
        </a>
      </header>
      <main id="main" className="static-page">
        <div className="page-top">
          <span className="eyebrow">404</span>
          <h1>الصفحة غير موجودة</h1>
          <p>ربما نُقلت الصفحة أو لم تعد موجودة.</p>
          <div className="actions">
            <a className="button" href="/">العودة إلى الرئيسية ←</a>
          </div>
        </div>
      </main>
      <footer>
        <span>سِكِل بوست · موقع غير تجاري</span>
        <div className="footer-links">
          <a href="/sources">المصادر والترخيص</a>
          <a href="/privacy">الخصوصية</a>
        </div>
      </footer>
    </>
  );
}

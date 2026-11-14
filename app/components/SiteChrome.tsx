import type { ReactNode } from "react";

type Props = {
  current?: "home" | "sheikhs" | "sources" | "privacy" | "login";
  children: ReactNode;
  footerNote?: string;
};

const links = [
  { href: "/#home", id: "home", label: "الرئيسية" },
  { href: "/#quran-reader", id: "quran", label: "القرآن" },
  { href: "/#adhkar-reader", id: "adhkar", label: "الأذكار" },
  { href: "/#prayer-tools", id: "prayer", label: "الصلاة والقبلة" },
  { href: "/sheikhs", id: "sheikhs", label: "المشايخ" },
  { href: "/sources", id: "sources", label: "المصادر" },
  { href: "/privacy", id: "privacy", label: "الخصوصية" },
] as const;

export function SiteChrome({ current, children, footerNote }: Props) {
  return (
    <>
      <a className="skip-link" href="#main">تخطَّ إلى المحتوى</a>
      <header>
        <a className="brand" href="/#home" aria-label="النور، الرئيسية">
          <span className="brand-icon" aria-hidden="true">✧</span>
          <span>النور<small>القرآن والذكر</small></span>
        </a>
        <button className="menu-toggle" id="menu-toggle" data-static type="button" aria-expanded="false" aria-controls="primary-nav">القائمة ☰</button>
        <nav id="primary-nav" aria-label="التنقل الرئيسي">
          {links.map((link) => (
            <a key={link.id} href={link.href} {...(current === link.id ? { "aria-current": "page" as const } : {})}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer>
        <span>{footerNote ?? "النور · موقع غير تجاري: لا إعلانات ولا بيع"}</span>
        <div className="footer-links">
          <a href="/sheikhs">المشايخ</a>
          <a href="/sources">المصادر والترخيص</a>
          <a href="/privacy">الخصوصية</a>
        </div>
        <span>صورة الكعبة: Neo Evenger / Pexels</span>
      </footer>
      <script src="/menu.js?v=20261110" defer />
      <script src="/yt-facade.js?v=20261110" defer />
    </>
  );
}

import "./globals.css";
import Link from "next/link";
import { Cairo } from "next/font/google";
import HeaderNav from "@/components/HeaderNav";
import CookieBanner from "@/components/CookieBanner";
import ChatWidget from "@/components/ChatWidget";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-cairo",
});

export const metadata = {
  title: "مهاراتي | SkillPost",
  description: "مجتمع مشاركة المشاريع والمهارات",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <svg className="brand-mark" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="9" fill="#ffffff" fillOpacity="0.18" />
              <path d="M16 6l2.6 6.4L25 15l-6.4 2.6L16 24l-2.6-6.4L7 15l6.4-2.6z" fill="#ffffff" />
            </svg>
            مهاراتي · SkillPost
          </Link>

          <HeaderNav />
        </header>

        <main>{children}</main>

        <footer>
        نسخة تطوير أولية ·{" "}
        <Link href="/about">عن المنصة</Link> ·{" "}
        <Link href="/privacy">الخصوصية</Link> ·{" "}
        <Link href="/terms">الشروط</Link> ·{" "}
        <Link href="/advertise">أعلن معنا</Link>
      </footer>   
        <ChatWidget />
        <CookieBanner />   
      </body>
    </html>
  );
}
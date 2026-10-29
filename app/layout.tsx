import "./globals.css";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import CookieBanner from "@/components/CookieBanner";

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
    <html lang="ar" dir="rtl">
      <body>
        <header>
          <Link href="/" className="brand">
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
        <CookieBanner />   
      </body>
    </html>
  );
}
import "./globals.css";
import Link from "next/link";
import AuthNavLink from "@/components/AuthNavLink";
import AdminNavLink from "@/components/AdminNavLink";
import NotificationBell from "@/components/NotificationBell";

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

          <nav>
            <Link href="/">المشاريع</Link>
            <Link href="/projects/new">نشر مشروع</Link>
            <Link href="/challenges">التحديات</Link>
            <Link href="/friends">الأصدقاء</Link>
            <AuthNavLink />
            <AdminNavLink />
            <NotificationBell />
            <Link href="/setup">التجهيز</Link>
          </nav>
        </header>

        <main>{children}</main>

        <footer>
        نسخة تطوير أولية ·{" "}
        <Link href="/about">عن المنصة</Link> ·{" "}
        <Link href="/privacy">الخصوصية</Link> ·{" "}
        <Link href="/terms">الشروط</Link> ·{" "}
        <Link href="/advertise">أعلن معنا</Link>
      </footer>   
      </body>
    </html>
  );
}
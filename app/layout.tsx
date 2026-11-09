// Root layout only used by the Next.js 404 page; the site itself is static HTML in /public.
export const metadata = { title: "الصفحة غير موجودة | سِكِل بوست", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}

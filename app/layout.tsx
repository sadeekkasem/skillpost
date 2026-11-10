import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./staff.css";

export const metadata: Metadata = {
  title: "سِكِل بوست",
  description: "موقع غير تجاري للقرآن والذكر",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="stylesheet" href="/style.css?v=20261110" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script src="/analytics.js?v=20261110" defer />
        <script src="/_vercel/insights/script.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}

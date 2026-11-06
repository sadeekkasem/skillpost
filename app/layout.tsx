import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cairo } from "next/font/google";
import HeaderNav from "@/components/HeaderNav";
import CookieBanner from "@/components/CookieBanner";
import ChatWidget from "@/components/ChatWidget";
import Brand from "@/components/Brand";
import SiteFooter from "@/components/SiteFooter";
import LanguageProvider from "@/components/LanguageProvider";
import LanguagePicker from "@/components/LanguagePicker";
import { dirOf } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import type { Metadata } from "next";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-cairo",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const { lang } = await getLang();
  const description = t("meta.description");
  const title = t("meta.title");
  return {
    metadataBase: new URL("https://www.skillpostapp.com"),
    title,
    description,
    applicationName: "SkillPost",
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      siteName: "SkillPost",
      title,
      description,
      url: "/",
      locale: lang === "ar" ? "ar_AR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#0e7a45" },
      { media: "(prefers-color-scheme: dark)", color: "#0e5a35" },
    ],
    appleWebApp: {
      capable: true,
      title: "SkillPost",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/icon-192.png"],
    },
  };
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, chosen } = await getLang();
  return (
    <html lang={lang} dir={dirOf(lang)} className={cairo.variable} suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "SkillPost",
              url: "https://skillpostapp.com",
              inLanguage: lang,
            }),
          }}
        />
        <LanguageProvider initialLang={lang} initialChosen={chosen}>
          <header className="site-header">
            <Brand />
            <HeaderNav />
          </header>

          <main>{children}</main>

          <SiteFooter />
          <ChatWidget />
          <CookieBanner />
          <LanguagePicker />
        </LanguageProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

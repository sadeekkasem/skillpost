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

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-cairo",
});

export async function generateMetadata() {
  const t = await getT();
  return {
    metadataBase: new URL("https://www.skillpostapp.com"),
    title: t("meta.title"),
    description: t("meta.description"),
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

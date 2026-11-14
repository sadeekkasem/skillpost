import type { Metadata } from "next";
import { SITE_NAME } from "../../lib/site";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: `صفحة الشيخ | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

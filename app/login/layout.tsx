import type { Metadata } from "next";
import { SITE_NAME } from "../../lib/site";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: `دخول العاملين | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}

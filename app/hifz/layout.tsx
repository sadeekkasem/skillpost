import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_NAME } from "../../lib/site";

export const metadata: Metadata = {
  title: `رفيق الحفظ | ${SITE_NAME}`,
  description: "خطة مرنة لحفظ القرآن ومتابعة التقدّم وعدّاد الأيام.",
};

export default function HifzLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/hifz.css?v=20261121h" />
      {children}
    </>
  );
}

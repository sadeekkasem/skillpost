import { SiteChrome } from "../components/SiteChrome";
import { loadHifzState } from "../../lib/hifz/store";
import "../../lib/hifz/data";
import { HifzApp } from "./HifzApp";

export const dynamic = "force-dynamic";

export default async function HifzPage() {
  const state = await loadHifzState();
  return (
    <SiteChrome current="hifz">
      <div className="static-page hifz-page">
        <div className="page-top">
          <span className="eyebrow">حفظ القرآن خطوة بخطوة</span>
          <h1>رفيق الحفظ</h1>
          <p>كل يوم ترى بطاقة اليوم فقط: ماذا تحفظ، وماذا تسجّل. والتقدّم يُحفظ في حسابك.</p>
        </div>
        <HifzApp initial={state} />
      </div>
    </SiteChrome>
  );
}

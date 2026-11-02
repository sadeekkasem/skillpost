import Link from "next/link";
import AdRequestForm from "@/components/AdRequestForm";

export const metadata = {
  title: "أعلن معنا | SkillPost",
  description: "قدّم طلب إعلان على منصة SkillPost",
};

export default function AdvertisePage() {
  return (
    <section
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 16px",
        lineHeight: 1.9,
      }}
    >
      <h1>أعلن معنا</h1>

      <p>
        عرّف زوار منصة SkillPost بخدمتك أو دورتك أو نشاطك.
        عبّئ النموذج، وسنتواصل معك لمراجعة التفاصيل
        وتحديد السعر ومكان العرض.
      </p>

      <p>
        يجب تسجيل الدخول لإرسال الطلب. معلومات التواصل
        متاحة لصاحب الطلب والإدارة فقط، وليست جزءًا
        من الإعلان المعروض للزوار.
      </p>

      <h2>طلب إعلان جديد</h2>

      <AdRequestForm />

      <p>
        <Link href="/">العودة إلى المشاريع</Link>
      </p>
    </section>
  );
}
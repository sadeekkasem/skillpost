// Classifies a HadeethEnc hadith by its published attribution (التخريج) and grade.
// Returns "agreed" (متفق عليه), "both" (البخاري ومسلم، كلٌّ برواية), "bukhari", "muslim", or null (excluded).
// Strict: anything that also cites another collector or book, a mu'allaq/أصله-type attribution,
// Muslim's muqaddimah, or a grade that is not plainly صحيح, is excluded. Nothing is changed.
const strip = (s) => String(s || "").replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/\s+/g, " ").trim();

const OTHER = /أبو داود|أبي داود|لأبي داود|الترمذي|النسائي|ابن ماج|أحمد|مالك|الموطأ|الدارمي|ابن حبان|الحاكم|البيهقي|الطبراني|عبد الرزاق|ابن خزيمة|الخرائطي|ابن أبي عاصم|ابن منده|أبو يعلى|ابن الأعرابي|الأصبهاني|أبي الشيخ|الحميدي|ابن الأثير|جامع الأصول|الأدب المفرد|خلق أفعال العباد|التاريخ الكبير|تعليق|معلق|أصله|مقدمته|الدارقطني|ابن أبي شيبة|سعيد بن منصور|البزار|أبو عوانة/;
const BAD_GRADE = /ضعيف|حسن|لغيره|بشواهده|موضوع|منكر|شاذ/;

export function classify(h) {
  const attr = strip(h.attribution);
  const grade = strip(h.grade);
  if (!grade.startsWith("صحيح") || BAD_GRADE.test(grade)) return null;
  if (OTHER.test(attr)) return null;
  const mB = /البخاري/.test(attr);
  const mM = /(^|[\s،و:])مسلم|صحيح مسلم|رواهما مسلم/.test(attr);
  if (/متفق/.test(attr) || /صحيحيهما|رواه البخاري ومسلم/.test(attr)) return "agreed";
  if (mB && mM) return "both";
  if (mB) return "bukhari";
  if (mM) return "muslim";
  return null;
}

export const BOOK_LABELS = { agreed: "متفق عليه", both: "البخاري ومسلم", bukhari: "صحيح البخاري", muslim: "صحيح مسلم" };

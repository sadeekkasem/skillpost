"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "../components/ActionForm";
import { requestHifzMagicLink, saveHifzPlan, completeTodayPortion, postponeTodayPortion, markRange } from "../../lib/hifz/actions";
import type { HifzState } from "../../lib/hifz/store";
import { getMushaf, formatRange, juzRange, pageRange, pagesInSurah, surahsInJuz, DEFAULT_TIMEZONE } from "../../lib/hifz/mushaf";
import { estimateFinish, nextPortion, weekdayName } from "../../lib/hifz/portion";
import { memorizedSet, juzStates, rangeMemorized, summarizeProgress, surahState } from "../../lib/hifz/progress";
import { isFreePostpone, isRestWeekday, todayNeedsWork } from "../../lib/hifz/streak";
import type { AmountUnit, Goal, Weekday } from "../../lib/hifz/types";
import "../../lib/hifz/data";

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const ALAFASY = "https://cdn.mp3quran.net/audio/mishary-alafasy/r1/";

export function HifzApp({ initial }: { initial: HifzState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  if (!initial.session) return <Intro fixtures={false} />;

  return (
    <LoggedIn
      initial={initial}
      pending={pending}
      message={message}
      onMessage={setMessage}
      refresh={() => start(() => router.refresh())}
    />
  );
}

function Intro({ fixtures }: { fixtures: boolean }) {
  return (
    <div className="hifz-grid">
      <article className="hifz-card">
        <h2>كيف يعمل رفيق الحفظ؟</h2>
        <p>تضع خطة بسيطة: هدفك، وكم تحفظ في اليوم، ومن أين تبدأ. بعد ذلك تظهر لك كل يوم بطاقة واحدة بما عليك حفظه. تضغط «تم الحفظ» أو «تأجيل للغد»، وترى خريطة المصحف وعدّاد الأيام المتتالية.</p>
        <p>التقدّم يُحفظ في حسابك، فينتقل بين الهاتف والكمبيوتر. يمكنك إنشاء حساب ببريدك من هذه الصفحة، وهو مستقل عن لوحة إدارة الموقع.</p>
      </article>
      <article className="hifz-card">
        <h2>تسجيل الدخول</h2>
        <p>أدخل بريدك لإنشاء حساب جديد أو للدخول إن كان لديك حساب. سيصلك رابط إلى بريدك، وبه تدخل إلى هذه الصفحة.</p>
        <ActionForm action={requestHifzMagicLink} className="staff-form">
          <input type="hidden" name="next" value="/hifz" />
          <label>
            البريد الإلكتروني
            <input type="email" name="email" required autoComplete="email" dir="ltr" />
          </label>
          <button className="button" type="submit">أرسل رابط الدخول</button>
        </ActionForm>
        {fixtures ? <p className="mini-label">وضع التجربة يظهر للمطوّر فقط، وليس على الموقع الحي.</p> : null}
      </article>
    </div>
  );
}

function LoggedIn({
  initial,
  pending,
  message,
  onMessage,
  refresh,
}: {
  initial: HifzState;
  pending: boolean;
  message: string;
  onMessage: (value: string) => void;
  refresh: () => void;
}) {
  if (!initial.plan) {
    return (
      <div className="hifz-grid">
        <p className="mini-label">مرحباً{initial.session?.email ? "، " + initial.session.email : ""}.</p>
        <PlanWizard onDone={refresh} onMessage={onMessage} message={message} />
      </div>
    );
  }
  return <Dashboard state={initial} pending={pending} message={message} onMessage={onMessage} refresh={refresh} />;
}

function PlanWizard({ onDone, onMessage, message }: { onDone: () => void; onMessage: (v: string) => void; message: string }) {
  const mushaf = getMushaf();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal>("new");
  const [unit, setUnit] = useState<AmountUnit>("ayat");
  const [amountValue, setAmountValue] = useState(5);
  const [fromEnd, setFromEnd] = useState(false);
  const [startSurah, setStartSurah] = useState(1);
  const [startAyah, setStartAyah] = useState(1);
  const [memorize, setMemorize] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [revise, setRevise] = useState<Weekday[]>([1, 2, 3, 4, 5, 6, 7]);
  const [rest, setRest] = useState<Weekday[]>([]);
  const [already, setAlready] = useState<string[]>([]);
  const start = fromEnd ? { surah: 114, ayah: 6 } : { surah: startSurah, ayah: startAyah };
  const estimate = useMemo(
    () =>
      estimateFinish(
        {
          amountUnit: unit,
          amountValue,
          start,
          fromEnd,
          memorizeWeekdays: memorize,
        },
        memorizedSet([]),
      ),
    [unit, amountValue, startSurah, startAyah, fromEnd, memorize],
  );
  const maxAyah = mushaf.surahs[startSurah - 1]?.ayahs ?? 1;

  function toggle(list: Weekday[], set: (v: Weekday[]) => void, day: Weekday) {
    set(list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort() as Weekday[]);
  }

  function toggleAlready(token: string) {
    setAlready((curr) => (curr.includes(token) ? curr.filter((t) => t !== token) : [...curr, token]));
  }

  async function save() {
    const data = new FormData();
    data.set("goal", goal);
    data.set("amountUnit", unit);
    data.set("amountValue", String(amountValue));
    data.set("fromEnd", fromEnd ? "1" : "0");
    data.set("startSurah", String(start.surah));
    data.set("startAyah", String(start.ayah));
    data.set("memorizeWeekdays", memorize.join(","));
    data.set("reviseWeekdays", revise.join(","));
    data.set("restWeekdays", rest.join(","));
    data.set("timezone", DEFAULT_TIMEZONE);
    data.set("already", already.join(","));
    const result = await saveHifzPlan(data);
    onMessage(result.message);
    if (result.ok) onDone();
  }

  return (
    <article className="hifz-card">
      <ol className="hifz-steps">
        <li className={step === 1 ? "is-current" : undefined}>1. الهدف</li>
        <li className={step === 2 ? "is-current" : undefined}>2. المقدار والبداية</li>
        <li className={step === 3 ? "is-current" : undefined}>3. الأيام وما تحفظه</li>
      </ol>

      {step === 1 ? (
        <div className="hifz-choice">
          {(
            [
              ["new", "حفظ جديد", "أحفظ سوراً أو آيات لم أحفظها من قبل."],
              ["revise", "تثبيت ومراجعة", "أراجع ما حفظته. الجدول التلقائي للمراجعة يُضاف في المرحلة التالية."],
              ["wird", "ورد يومي", "أقرأ مقداراً يومياً دون التزام الحفظ."],
            ] as const
          ).map(([id, title, hint]) => (
            <label key={id} className={goal === id ? "is-selected" : undefined}>
              <input type="radio" name="goal" checked={goal === id} onChange={() => setGoal(id)} />
              <span>
                {title}
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <>
          <div className="hifz-choice">
            {(
              [
                ["ayat-3", "ayat", 3, "3 آيات"],
                ["ayat-5", "ayat", 5, "5 آيات"],
                ["ayat-10", "ayat", 10, "10 آيات"],
                ["half_page", "half_page", 1, "نصف وجه (نصف صفحة)"],
                ["page", "page", 1, "وجه / صفحة"],
              ] as const
            ).map(([key, u, value, label]) => (
              <label key={key} className={unit === u && amountValue === value ? "is-selected" : undefined}>
                <input
                  type="radio"
                  name="amount"
                  checked={unit === u && (u !== "ayat" || amountValue === value)}
                  onChange={() => {
                    setUnit(u);
                    setAmountValue(value);
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="hifz-fields">
            <label>
              <span>
                <input type="checkbox" checked={fromEnd} onChange={(e) => setFromEnd(e.target.checked)} /> من آخر المصحف
              </span>
            </label>
            {!fromEnd ? (
              <div className="hifz-fields" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label>
                  سورة البداية
                  <select
                    value={startSurah}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setStartSurah(id);
                      setStartAyah(1);
                    }}
                  >
                    {mushaf.surahs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id}. {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  آية البداية
                  <input type="number" min={1} max={maxAyah} value={startAyah} onChange={(e) => setStartAyah(Number(e.target.value))} />
                </label>
              </div>
            ) : (
              <p>تبدأ من سورة الناس وتسير نحو بداية المصحف.</p>
            )}
          </div>
          {estimate ? <p className="hifz-estimate">{estimate.label}</p> : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h3>أيام الحفظ الجديد</h3>
          <div className="hifz-weekdays">
            {DAYS.map((d) => (
              <label key={"m" + d} className={memorize.includes(d) ? "is-selected" : undefined}>
                <input type="checkbox" checked={memorize.includes(d)} onChange={() => toggle(memorize, setMemorize, d)} />
                {weekdayName(d)}
              </label>
            ))}
          </div>
          <h3>أيام المراجعة</h3>
          <div className="hifz-weekdays">
            {DAYS.map((d) => (
              <label key={"r" + d} className={revise.includes(d) ? "is-selected" : undefined}>
                <input type="checkbox" checked={revise.includes(d)} onChange={() => toggle(revise, setRevise, d)} />
                {weekdayName(d)}
              </label>
            ))}
          </div>
          <h3>يوم راحة اختياري (لا يكسر العدّاد)</h3>
          <div className="hifz-weekdays">
            {DAYS.map((d) => (
              <label key={"t" + d} className={rest.includes(d) ? "is-selected" : undefined}>
                <input type="checkbox" checked={rest.includes(d)} onChange={() => toggle(rest, setRest, d)} />
                {weekdayName(d)}
              </label>
            ))}
          </div>
          <h3>ما الذي تحفظه مسبقاً؟ (اختياري)</h3>
          <p>علّم الأجزاء المحفوظة الآن، فتدخل في الخريطة ونسبة الإنجاز.</p>
          <div className="hifz-bulk">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((id) => {
              const token = "juz:" + id;
              return (
                <label key={token} className={already.includes(token) ? "is-selected" : undefined}>
                  <input type="checkbox" checked={already.includes(token)} onChange={() => toggleAlready(token)} />
                  الجزء {id}
                </label>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="hifz-actions">
        {step > 1 ? (
          <button className="button secondary" type="button" onClick={() => setStep(step - 1)}>
            السابق
          </button>
        ) : null}
        {step < 3 ? (
          <button className="button" type="button" onClick={() => setStep(step + 1)}>
            التالي
          </button>
        ) : (
          <button className="button" type="button" onClick={() => void save()}>
            احفظ الخطة
          </button>
        )}
      </div>
      {message ? <p className="hifz-msg" role="status">{message}</p> : null}
    </article>
  );
}

function Dashboard({
  state,
  pending,
  message,
  onMessage,
  refresh,
}: {
  state: HifzState;
  pending: boolean;
  message: string;
  onMessage: (v: string) => void;
  refresh: () => void;
}) {
  const plan = state.plan!;
  const bits = useMemo(() => memorizedSet(state.segments), [state.segments]);
  const progress = useMemo(() => summarizeProgress(bits), [bits]);
  const portion = useMemo(() => nextPortion(plan, bits), [plan, bits]);
  const rest = isRestWeekday(plan, state.today, plan.timezone);
  const needsWork = todayNeedsWork(plan, state.today, plan.timezone);
  const todayLog = state.logs.find((l) => l.logDate === state.today);
  const doneToday = Boolean(todayLog?.newCompleted);
  const postponedToday = Boolean(todayLog?.postponed);
  const freePostpone = isFreePostpone(state.today, state.logs, plan.timezone);
  const [openJuz, setOpenJuz] = useState<number | null>(null);
  const [openSurah, setOpenSurah] = useState<number | null>(null);
  const audioSrc = portion ? ALAFASY + String(portion.start.surah).padStart(3, "0") + ".mp3" : "";

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    const result = await action();
    onMessage(result.message);
    if (result.ok) refresh();
  }

  return (
    <div className="hifz-grid">
      <article className="hifz-card" id="hifz-today">
        <span className="eyebrow">بطاقة اليوم · {state.today}</span>
        <h2>
          {plan.goal === "wird" ? "ورد اليوم" : plan.goal === "revise" ? "مراجعة اليوم" : "حفظ اليوم"}
        </h2>
        {rest ? (
          <p>اليوم يوم راحة في خطتك. العدّاد لا ينكسر.</p>
        ) : doneToday ? (
          <p>أحسنت، سُجّل إنجاز اليوم.</p>
        ) : postponedToday ? (
          <p>أُجّل ورد اليوم إلى الغد{freePostpone ? "" : "، وهذا التأجيل لا يُحتسب في العدّاد لأنه ليس الأول هذا الأسبوع"}.</p>
        ) : !needsWork ? (
          <p>لا حفظ جديد في جدول اليوم. يمكنك المراجعة من الخريطة إن شئت.</p>
        ) : plan.goal === "revise" && !portion ? (
          <p>علّم ما حفظته في الخريطة أولاً. المراجعة التلقائية اليومية تُضاف في المرحلة التالية.</p>
        ) : portion ? (
          <>
            <p className="hifz-today-range">{portion.label}</p>
            <p>{portion.ayahCount} آية.</p>
            <audio className="hifz-audio" controls preload="none" src={audioSrc}>
              تلاوة مشاري العفاسي للسورة من MP3Quran. قد تكون التلاوة للسورة كاملة.
            </audio>
            <p className="mini-label">التلاوة للسورة كاملة من المكتبة الصوتية MP3Quran، بصوت مشاري العفاسي.</p>
          </>
        ) : (
          <p>أتممت المسار المحدد في خطتك. يمكنك تعليم مواضع أخرى من الخريطة أو تعديل نقطة البداية لاحقاً.</p>
        )}
        {!rest && needsWork && !doneToday ? (
          <div className="hifz-actions">
            <button className="button" type="button" disabled={pending} onClick={() => void run(completeTodayPortion)}>
              {plan.goal === "wird" ? "تم الورد" : "تم الحفظ"}
            </button>
            <button className="button secondary" type="button" disabled={pending} onClick={() => void run(postponeTodayPortion)}>
              تأجيل للغد{freePostpone ? "" : " (يُحسب في العدّاد مرة واحدة أسبوعياً)"}
            </button>
          </div>
        ) : null}
        {message ? <p className="hifz-msg" role="status">{message}</p> : null}
      </article>

      <article className="hifz-card">
        <div className="hifz-progress">
          <h3>التقدّم</h3>
          <div className="hifz-progress-bar" aria-hidden="true">
            <span style={{ width: Math.min(100, progress.percent) + "%" }} />
          </div>
          <p>{progress.label}</p>
          <p className="hifz-streak">
            🔥 العدّاد الحالي: <strong>{state.streak.current}</strong>
            {" · "}أطول سلسلة: {state.streak.longest}
          </p>
        </div>
      </article>

      <article className="hifz-card">
        <h3>خريطة الأجزاء</h3>
        <p>الذهبي محفوظ بالكامل، والأخضر الداكن لم يُحفظ بعد. اضغط الجزء لتعليم سوره أو صفحاته.</p>
        <div className="juz-grid">
          {juzStates(bits).map((juz) => (
            <button
              key={juz.id}
              type="button"
              className={(juz.state === "all" ? "is-done " : "") + (openJuz === juz.id ? "is-open" : "")}
              onClick={() => {
                setOpenJuz(openJuz === juz.id ? null : juz.id);
                setOpenSurah(null);
              }}
            >
              الجزء {juz.id}
            </button>
          ))}
        </div>
        {openJuz ? (
          <div className="hifz-surah-list">
            <div className="hifz-actions">
              <button
                className="button"
                type="button"
                disabled={pending}
                onClick={() => void run(() => markRange(markForm("juz", openJuz, true)))}
              >
                تعليم الجزء كله محفوظاً
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={pending}
                onClick={() => void run(() => markRange(markForm("juz", openJuz, false)))}
              >
                إلغاء تعليم الجزء
              </button>
            </div>
            {surahsInJuz(openJuz).map((surah) => {
              const st = surahState(bits, surah);
              return (
                <div key={surah.id}>
                  <button
                    type="button"
                    className={st === "all" ? "is-done" : undefined}
                    onClick={() => setOpenSurah(openSurah === surah.id ? null : surah.id)}
                  >
                    {surah.id}. {surah.name} · {st === "all" ? "محفوظ" : st === "some" ? "بعضه محفوظ" : "غير محفوظ"}
                  </button>
                  {openSurah === surah.id ? (
                    <div className="hifz-page-list">
                      <button type="button" className={st === "all" ? "is-done" : undefined} onClick={() => void run(() => markRange(markForm("surah", surah.id, st !== "all")))}>
                        {st === "all" ? "إلغاء تعليم السورة" : "تعليم السورة محفوظة"}
                      </button>
                      {pagesInSurah(surah.id).map((page) => {
                        const range = pageRange(page);
                        const pst = rangeMemorized(bits, range.start, range.end);
                        return (
                          <button key={page} type="button" className={pst === "all" ? "is-done" : undefined} onClick={() => void run(() => markRange(markForm("page", page, pst !== "all")))}>
                            ص {page}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function markForm(kind: "juz" | "surah" | "page", id: number, memorized: boolean): FormData {
  const data = new FormData();
  data.set("kind", kind);
  data.set("id", String(id));
  data.set("memorized", memorized ? "1" : "0");
  return data;
}

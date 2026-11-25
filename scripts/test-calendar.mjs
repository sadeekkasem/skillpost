// Automated checks for public/calendar.js (Hijri month logic and .ics). Run: node scripts/test-calendar.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../public/calendar.js");
let fail = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
const d = (y, m, day) => new Date(Date.UTC(y, m - 1, day, 12));
ok(C.supported("islamic-umalqura") && C.supported("islamic-civil"), "runtime supports both Hijri calendars");
const h = C.hijriParts(d(2025, 6, 26), "islamic-umalqura");
ok(h.y === 1447 && h.m === 1 && h.d === 1, "26 June 2025 = 1 Muharram 1447 (Umm al-Qura)");
for (const sys of ["islamic-umalqura", "islamic-civil"]) {
  let anchor = d(2026, 1, 1), okAll = true, prevEnd = null;
  for (let i = 0; i < 24; i++) {
    const mo = C.monthOf(anchor, sys);
    const len = mo.days.length;
    if (len < 29 || len > 30) okAll = false;
    if (C.hijriParts(mo.days[0], sys).d !== 1) okAll = false;
    if (prevEnd && mo.days[0].getTime() - prevEnd.getTime() !== 864e5) okAll = false;
    prevEnd = mo.days[len - 1];
    anchor = new Date(prevEnd.getTime() + 864e5);
  }
  ok(okAll, sys + ": 24 consecutive months are 29–30 days, start on day 1, and are contiguous");
}
const up = C.upcoming(d(2026, 11, 25), "islamic-umalqura", 8);
ok(up.length === 8 && up.every((e, i) => i === 0 || e.date >= up[i - 1].date), "upcoming events are returned in date order");
ok(up.every((e) => C.EVENTS.some((x) => x.m === e.h.m && x.d === e.h.d)), "every upcoming event matches its fixed Hijri date");
const ics = C.ics(up[0]);
ok(/BEGIN:VCALENDAR[\s\S]*DTSTART;VALUE=DATE:\d{8}[\s\S]*END:VCALENDAR/.test(ics), ".ics file has a valid all-day event");
console.log(fail ? fail + " failed" : "all calendar checks passed"); process.exit(fail ? 1 : 0);

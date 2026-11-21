import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const {
  TIMING_API,
  normalizeTimings,
  findAyahAtTime,
  timingUrl,
  reciterSupportsTiming,
} = require(path.join(root, 'public/ayah-timings.js'));

const catalog = JSON.parse(readFileSync(path.join(root, 'public/data/reciters.json'), 'utf8'));
const indexHtml = readFileSync(path.join(root, 'public/index.html'), 'utf8');
const appJs = readFileSync(path.join(root, 'public/app.js'), 'utf8');
const csp = readFileSync(path.join(root, 'next.config.ts'), 'utf8');
const sources = readFileSync(path.join(root, 'public/sources.html'), 'utf8');
const privacy = readFileSync(path.join(root, 'public/privacy.html'), 'utf8');

let failed = 0;
function ok(cond, message) {
  if (cond) console.log('ok -', message);
  else {
    failed += 1;
    console.error('not ok -', message);
  }
}

const fatiha = [
  { ayah: 1, start_time: 6420, end_time: 11120 },
  { ayah: 2, start_time: 11120, end_time: 18920 },
  { ayah: 3, start_time: 18920, end_time: 24120 },
  { ayah: 4, start_time: 24120, end_time: 28960 },
  { ayah: 5, start_time: 28960, end_time: 34880 },
  { ayah: 6, start_time: 34880, end_time: 38960 },
  { ayah: 7, start_time: 38960, end_time: 51200 },
];

const normalized = normalizeTimings(fatiha, 7);
ok(Array.isArray(normalized) && normalized.length === 7, 'normalize accepts an exact 1..7 set');
ok(normalized[0].ayah === 1 && normalized[6].ayah === 7, 'normalized ayat stay 1..7');
ok(findAyahAtTime(normalized, 0) === null, 'time before first ayah is not highlighted');
ok(findAyahAtTime(normalized, 6419) === null, 'one ms before first start is not highlighted');
ok(findAyahAtTime(normalized, 6420) === 1, 'exact first start maps to ayah 1');
ok(findAyahAtTime(normalized, 11119) === 1, 'last ms of ayah 1 stays on ayah 1');
ok(findAyahAtTime(normalized, 11120) === 2, 'shared boundary belongs to the next ayah');
ok(findAyahAtTime(normalized, 40000) === 7, 'mid ayah 7 maps correctly');
ok(findAyahAtTime(normalized, 51200) === 7, 'exact last end stays on the last ayah');
ok(findAyahAtTime(normalized, 51201) === null, 'after the last end clears the highlight');
ok(findAyahAtTime(normalized, Number.NaN) === null, 'NaN time returns null');
ok(findAyahAtTime(null, 1000) === null, 'missing timings return null');

const withIntro = [{ ayah: 0, start_time: 0, end_time: 4495 }, ...fatiha.map((row, i) => ({
  ayah: row.ayah,
  start_time: row.start_time + 100,
  end_time: row.end_time + 100,
}))];
ok(normalizeTimings(withIntro, 7)?.length === 7, 'ayah 0 intro is ignored and 1..7 still validates');

ok(normalizeTimings(fatiha, 6) === null, 'wrong expected count is rejected');
ok(normalizeTimings([{ ayah: 0, start_time: 0, end_time: 11705 }, ...fatiha.slice(0, 6)], 7) === null, 'Husary-style Fatiha gap (0 + 1..6) is not guessed');
ok(normalizeTimings([{ ayah: 1, start_time: 10, end_time: 5 }], 1) === null, 'end before start is rejected');
ok(normalizeTimings([{ ayah: 1, start_time: 100, end_time: 200 }, { ayah: 2, start_time: 50, end_time: 80 }], 2) === null, 'non-monotonic starts are rejected');
ok(normalizeTimings([{ ayah: 1, start_time: 0, end_time: 10 }, { ayah: 3, start_time: 10, end_time: 20 }], 2) === null, 'missing ayah 2 is rejected');
ok(normalizeTimings('bad', 7) === null, 'non-array payload is rejected');
ok(normalizeTimings([], 7) === null, 'empty payload is rejected');

const longFixture = Array.from({ length: 286 }, (_, i) => ({
  ayah: i + 1,
  start_time: i * 1000,
  end_time: (i + 1) * 1000,
}));
const longNormalized = normalizeTimings(longFixture, 286);
ok(longNormalized?.length === 286, 'normalize accepts a 286-ayah surah');
ok(findAyahAtTime(longNormalized, 0) === 1, 'binary search finds the first ayah of a long surah');
ok(findAyahAtTime(longNormalized, 149999) === 150, 'binary search finds a mid ayah (150) in 286');
ok(findAyahAtTime(longNormalized, 150000) === 151, 'binary search boundary at ayah 151');
ok(findAyahAtTime(longNormalized, 285000) === 286, 'binary search finds the last ayah of a long surah');
ok(findAyahAtTime(longNormalized, 286001) === null, 'time past the long surah clears the highlight');

ok(timingUrl(1, 123) === 'https://www.mp3quran.net/api/v3/ayat_timing?surah=1&read=123', 'timing URL uses www API v3');
ok(timingUrl(0, 123) === null && timingUrl(1, 0) === null, 'timing URL rejects invalid ids');
ok(TIMING_API === 'https://www.mp3quran.net/api/v3/ayat_timing', 'API constant points at the official endpoint');

const byId = Object.fromEntries(catalog.reciters.map((r) => [r.id, r]));
ok(catalog.reciters.filter((r) => r.has_ayat_timing === true).length === 7, 'all seven reciters are marked as having timings');
ok(byId['maher-muaiqly']?.has_ayat_timing === true && byId['maher-muaiqly'].moshaf_id === 133, 'Maher uses moshaf 133 (r3) with official timings');
ok(byId['mishary-alafasy']?.has_ayat_timing === true && byId['mishary-alafasy'].moshaf_id === 123, 'Mishary is marked with moshaf 123');
ok(reciterSupportsTiming(byId['mishary-alafasy']) === true, 'helper accepts a supported reciter');
ok(reciterSupportsTiming(byId['maher-muaiqly']) === true, 'helper accepts Maher on the timed moshaf');
ok(reciterSupportsTiming({ id: 'legacy-alafasy', moshaf_id: 123 }) === true, 'helper still requests timings when a cached catalog omits has_ayat_timing');
ok(reciterSupportsTiming({ id: 'explicit-off', moshaf_id: 123, has_ayat_timing: false }) === false, 'helper skips reciters explicitly marked without timings');
ok(reciterSupportsTiming({ id: 'no-moshaf', has_ayat_timing: true }) === false, 'helper rejects a reciter without a moshaf id');

ok(indexHtml.includes('ayah-timings.js?v=20261121c'), 'index.html loads ayah-timings.js with a cache-busting version');
ok(indexHtml.includes('id="audio-autoscroll"'), 'index.html has an auto-scroll toggle');
ok(indexHtml.includes('id="timing-note"'), 'index.html has a timing note slot');
ok(!indexHtml.includes('لا مزامنة آيات'), 'old “no ayah sync” copy is gone from the player');
ok(appJs.includes('AyahTimings.findAyahAtTime'), 'app.js uses the timing helper');
ok(appJs.includes("addEventListener('timeupdate'"), 'app.js listens to timeupdate');
ok(csp.includes("connect-src 'self' https://www.mp3quran.net"), 'CSP allows timing fetches to www.mp3quran.net');
ok(sources.includes('ayat_timing'), 'sources page cites the ayat_timing endpoint');
ok(privacy.includes('ayat_timing') || privacy.includes('مواقيت الآيات'), 'privacy mentions the timing request');

const firstRender = appJs.indexOf('window.__quranShown=renderQuran;renderQuran();');
const recitingDecl = appJs.search(/let [\s\S]{0,240}recitingAyah=/);
ok(recitingDecl !== -1 && recitingDecl < firstRender, 'recitingAyah is declared before the first renderQuran() call');
ok(appJs.includes("addEventListener('click',playAudio)"), 'play button is bound to playAudio');
ok(appJs.includes("addEventListener('click',pauseAudio)"), 'pause button is bound to pauseAudio');
ok(appJs.includes("addEventListener('click',()=>stopAudio())"), 'stop button is bound to stopAudio');

const fallbackPath = path.join(root, 'public/data/ayah-audio-fallback.json');
const fallback = JSON.parse(readFileSync(fallbackPath, 'utf8'));
const husaryFatiha = fallback.reciters?.['mahmoud-husary']?.['1'];
ok(Boolean(husaryFatiha), 'Husary Fatiha has an EveryAyah fallback entry');
ok(husaryFatiha.server === 'https://everyayah.com/data/Husary_128kbps/', 'fallback server is EveryAyah HTTPS');
ok(husaryFatiha.ayah_count === 7, 'fallback covers all 7 Fatiha ayat');
ok(appJs.includes("/data/reciters.json?v=20261121c"), 'app fetches the reciter catalog with a cache-busting version');
ok(appJs.includes("/data/ayah-audio-fallback.json?v=20261121c"), 'app fetches the verse-file fallback catalog with a cache-busting version');
ok(csp.includes('/data/:path*') && csp.includes('max-age=3600, must-revalidate') && !csp.includes('stale-while-revalidate=604800'), 'data files no longer use a 24-hour stale-while-revalidate cache');
ok(csp.includes('https://everyayah.com'), 'CSP media-src allows EveryAyah');
ok(sources.includes('everyayah.com/data/Husary_128kbps'), 'sources cite the EveryAyah Husary verse files');
ok(privacy.includes('everyayah.com'), 'privacy mentions the EveryAyah connection');
ok(appJs.includes('playCurrentAyahFile'), 'app can play verse files sequentially for the fallback');


async function fetchTimings(surah, readId) {
  const url = timingUrl(surah, readId);
  const res = await fetch(url, { headers: { 'User-Agent': 'SkillPostIslamic/1.0 (non-commercial timing check)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

console.log('\nLive timing counts (Fatiha + Al-Baqarah):');
const expected = { 1: 7, 2: 286 };
for (const reciter of catalog.reciters) {
  for (const surah of [1, 2]) {
    const label = `${reciter.id} surah ${String(surah).padStart(3, '0')} read=${reciter.moshaf_id}`;
    if (!reciterSupportsTiming(reciter)) {
      const raw = await fetchTimings(surah, reciter.moshaf_id);
      ok(Array.isArray(raw) && raw.length === 0 && normalizeTimings(raw, expected[surah]) === null, `${label} has no usable timings (highlight disabled)`);
      continue;
    }
    try {
      const raw = await fetchTimings(surah, reciter.moshaf_id);
      const timings = normalizeTimings(raw, expected[surah]);
      if (reciter.id === 'mahmoud-husary' && surah === 1) {
        ok(timings === null, `${label} Fatiha payload does not match 7 ayat; highlight stays off rather than guessing`);
      } else {
        ok(timings !== null && timings.length === expected[surah], `${label} timing count equals ${expected[surah]} ayat`);
      }
    } catch (error) {
      ok(false, `${label} -> ${error.message}`);
    }
  }
}

console.log('\nEveryAyah Husary Fatiha verse files:');
for (let ayah = 1; ayah <= 7; ayah += 1) {
  const url = `${husaryFatiha.server}001${String(ayah).padStart(3, '0')}.mp3`;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'SkillPostIslamic/1.0 (non-commercial audio check)' } });
    const type = res.headers.get('content-type') || '';
    ok(res.ok && (type.includes('audio') || type.includes('mpeg') || type.includes('octet-stream')), `Husary Fatiha ayah ${ayah} ${res.status} ${type} ${url}`);
  } catch (error) {
    ok(false, `${url} -> ${error.message}`);
  }
}

console.log('\nMaher moshaf 133 sample surahs:');
for (const surah of [1, 2, 18, 36, 114]) {
  const expectedAyat = { 1: 7, 2: 286, 18: 110, 36: 83, 114: 6 }[surah];
  try {
    const raw = await fetchTimings(surah, 133);
    const timings = normalizeTimings(raw, expectedAyat);
    ok(timings !== null && timings.length === expectedAyat, `maher-muaiqly r3 surah ${String(surah).padStart(3, '0')} timing count equals ${expectedAyat} ayat`);
  } catch (error) {
    ok(false, `maher-muaiqly r3 surah ${surah} -> ${error.message}`);
  }
}

if (failed) {
  console.error(`\n${failed} ayah-timing checks failed`);
  process.exit(1);
}
console.log('\nAll ayah-timing checks passed');

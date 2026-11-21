import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const { normalizeTimings, timingUrl, reciterSupportsTiming } = require(path.join(root, 'public/ayah-timings.js'));
const catalog = JSON.parse(readFileSync(path.join(root, 'public/data/reciters.json'), 'utf8'));
const fallback = JSON.parse(readFileSync(path.join(root, 'public/data/ayah-audio-fallback.json'), 'utf8'));

// Official MP3Quran payloads that do not contain exactly ayat 1..N for this moshaf.
// The player leaves highlighting off rather than guessing. Keep this list in lockstep with live data.
const knownOfficialGaps = {
  'mahmoud-husary': [1],
  'muhammad-minshawi': [9],
  'saud-shuraim': [9, 12, 65, 91],
};


const quranDir = path.join(root, 'public/data/quran');
const ayahCounts = {};
for (const file of readdirSync(quranDir).filter((name) => /^\d{3}\.json$/.test(name))) {
  const data = JSON.parse(readFileSync(path.join(quranDir, file), 'utf8'));
  ayahCounts[data.surah] = data.verses.length;
}
const surahIds = Array.from({ length: 114 }, (_, i) => i + 1);

let failed = 0;
let passed = 0;
const gaps = [];

function ok(cond, message) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    gaps.push(message);
    console.error('not ok -', message);
  }
}

function fallbackEntry(reciterId, surah) {
  return fallback.reciters?.[reciterId]?.[String(surah)] || null;
}

async function fetchTimings(surah, readId) {
  const url = timingUrl(surah, readId);
  const res = await fetch(url, { headers: { 'User-Agent': 'SkillPostIslamic/1.0 (non-commercial timing check)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

async function audioDurationMs(url) {
  const { stdout } = await execFileP('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', url], { timeout: 40000 });
  const seconds = Number(String(stdout).trim());
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

ok(surahIds.every((id) => ayahCounts[id] > 0), 'ayah counts loaded for 114 surahs');
ok(catalog.reciters.length === 7, 'catalog still has seven reciters');

const queue = [];
for (const reciter of catalog.reciters) {
  ok(reciterSupportsTiming(reciter), `${reciter.id} official moshaf is listed as having timings`);
  for (const surah of surahIds) {
    queue.push({ reciter, surah, expected: ayahCounts[surah] });
  }
}

const concurrency = 8;
console.log(`Checking ${queue.length} reciter/surah timing sets...`);
let index = 0;
async function worker() {
  while (index < queue.length) {
    const item = queue[index];
    index += 1;
    const { reciter, surah, expected } = item;
    const fb = fallbackEntry(reciter.id, surah);
    try {
      const raw = await fetchTimings(surah, reciter.moshaf_id);
      const timings = normalizeTimings(raw, expected);
      if (fb) {
        ok(timings === null, `${reciter.id} surah ${surah}: official timings incomplete as documented; fallback applies`);
        ok(fb.ayah_count === expected && typeof fb.server === 'string', `${reciter.id} surah ${surah}: fallback metadata matches ${expected} ayat`);
        continue;
      }
      if (timings == null) {
        const known = knownOfficialGaps[reciter.id]?.includes(surah);
        ok(known, `${reciter.id} surah ${surah}: ${known ? 'official gap documented; highlight stays off' : 'no usable official timings and no fallback'}`);
        continue;
      }
      if (knownOfficialGaps[reciter.id]?.includes(surah)) {
        ok(false, `${reciter.id} surah ${surah}: listed as a known gap but official timings now match`);
      }
      const mono = timings.every((row, i) => i === 0 || row.start >= timings[i - 1].start);
      ok(timings.length === expected && mono, `${reciter.id} surah ${surah}: ${timings.length} monotonic timings`);
    } catch (error) {
      ok(false, `${reciter.id} surah ${surah}: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const durationSamples = [1, 2, 18, 36, 67, 78, 112, 113, 114];
console.log(`\nChecking last timing against audio duration for ${durationSamples.length} surahs × ${catalog.reciters.length} reciters...`);
for (const reciter of catalog.reciters) {
  for (const surah of durationSamples) {
    if (fallbackEntry(reciter.id, surah)) continue;
    const url = `${reciter.server}${String(surah).padStart(3, '0')}.mp3`;
    try {
      const raw = await fetchTimings(surah, reciter.moshaf_id);
      const timings = normalizeTimings(raw, ayahCounts[surah]);
      const duration = await audioDurationMs(url);
      if (duration == null) {
        console.log(`skip duration ${reciter.id} ${surah}: could not parse duration`);
        continue;
      }
      const lastEnd = timings[timings.length - 1].end;
      ok(lastEnd <= duration + 500, `${reciter.id} surah ${surah}: last end ${lastEnd}ms <= duration ${Math.round(duration)}ms`);
    } catch (error) {
      ok(false, `${reciter.id} surah ${surah} duration -> ${error.message}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (gaps.length) {
  console.log('Gaps:');
  for (const gap of gaps) console.log(' -', gap);
}
if (failed) process.exit(1);
console.log('All coverage checks passed');

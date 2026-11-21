import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const catalogPath = path.join(root, 'public/data/reciters.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const expectedSurahs = Array.from({ length: 114 }, (_, i) => i + 1);

let failed = 0;
function ok(cond, message) {
  if (cond) {
    console.log('ok -', message);
  } else {
    failed += 1;
    console.error('not ok -', message);
  }
}

function surahAudioUrl(surah, reciter) {
  if (!reciter || !Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error('Invalid surah');
  }
  if (!Array.isArray(reciter.surah_list) || !reciter.surah_list.includes(surah)) {
    throw new Error('Surah not in moshaf');
  }
  const server = reciter.server;
  if (typeof server !== 'string' || !server.startsWith('https://') || !server.endsWith('/')) {
    throw new Error('Invalid server');
  }
  return `${server}${String(surah).padStart(3, '0')}.mp3`;
}

ok(catalog.source_api === 'https://www.mp3quran.net/api/v3/reciters?language=ar', 'catalog records official v3 API');
ok(catalog.file_pattern === '{surah:03d}.mp3', 'official three-digit mp3 pattern');
ok(catalog.default_id === 'mishary-alafasy', 'default reciter is Mishary Alafasy');
ok(Array.isArray(catalog.reciters) && catalog.reciters.length === 7, 'seven complete reciters included');

const ids = catalog.reciters.map((r) => r.id);
ok(ids[0] === 'mishary-alafasy', 'default reciter is first in the list');
ok(new Set(ids).size === ids.length, 'reciter ids are unique');

for (const reciter of catalog.reciters) {
  ok(typeof reciter.id === 'string' && reciter.id.length > 0, `${reciter.id || '?'} has an id`);
  ok(typeof reciter.name_ar === 'string' && reciter.name_ar.length > 0, `${reciter.id} has an Arabic name`);
  const expectedMoshaf = reciter.id === 'maher-muaiqly' ? 'حفص عن عاصم - المصحف المجود' : 'حفص عن عاصم - مرتل';
  ok(reciter.moshaf_name === expectedMoshaf, `${reciter.id} uses ${expectedMoshaf}`);
  ok(typeof reciter.has_ayat_timing === 'boolean', `${reciter.id} records timing support`);
  ok(reciter.has_ayat_timing === true, `${reciter.id} has official ayat timings for this moshaf`);
  ok(typeof reciter.server === 'string' && reciter.server.startsWith('https://') && reciter.server.endsWith('/'), `${reciter.id} has an https server URL`);
  ok(!reciter.server.includes(' '), `${reciter.id} server has no spaces`);
  ok(new URL(reciter.server).protocol === 'https:', `${reciter.id} server parses as https`);
  ok(reciter.surah_total === 114, `${reciter.id} surah_total is 114`);
  ok(Array.isArray(reciter.surah_list) && reciter.surah_list.length === 114, `${reciter.id} surah_list has 114 entries`);
  ok(JSON.stringify(reciter.surah_list) === JSON.stringify(expectedSurahs), `${reciter.id} surah_list is exactly 1..114`);
  ok(surahAudioUrl(1, reciter) === `${reciter.server}001.mp3`, `${reciter.id} builds 001.mp3`);
  ok(surahAudioUrl(114, reciter) === `${reciter.server}114.mp3`, `${reciter.id} builds 114.mp3`);
  let threw = false;
  try {
    surahAudioUrl(0, reciter);
  } catch {
    threw = true;
  }
  ok(threw, `${reciter.id} rejects invalid surah 0`);
}

const indexHtml = readFileSync(path.join(root, 'public/index.html'), 'utf8');
const selectBlock = indexHtml.match(/id="reciter-select">([\s\S]*?)<\/select>/);
ok(Boolean(selectBlock), 'index.html has a reciter select');
const optionIds = selectBlock ? [...selectBlock[1].matchAll(/value="([^"]+)"/g)].map((m) => m[1]) : [];
ok(JSON.stringify(optionIds) === JSON.stringify(ids), 'index.html options match catalog ids and order');
ok(indexHtml.includes('id="audio-reciter-heading"'), 'audio heading is bound to the selected reciter');
ok(indexHtml.includes('يُحفظ اختيار القارئ في هذا المتصفح فقط'), 'index discloses localStorage-only reciter choice');

const appJs = readFileSync(path.join(root, 'public/app.js'), 'utf8');
ok(appJs.includes("RECITER_KEY='skillpost-quran-reciter-v1'"), 'choice is stored under a dedicated localStorage key');
ok(appJs.includes('localStorage.setItem(RECITER_KEY'), 'reciter choice is written to localStorage only');
ok(!appJs.includes('document.cookie') && !appJs.includes('server8.mp3quran.net'), 'app.js has no cookies and no leftover server8 URL');

const csp = readFileSync(path.join(root, 'next.config.ts'), 'utf8');
ok(csp.includes('media-src https://cdn.mp3quran.net'), 'CSP media-src allows the official CDN host');
ok(!csp.includes('server8.mp3quran.net'), 'CSP no longer allows the retired server8 host');

const privacy = readFileSync(path.join(root, 'public/privacy.html'), 'utf8');
const sources = readFileSync(path.join(root, 'public/sources.html'), 'utf8');
ok(privacy.includes('cdn.mp3quran.net') && !privacy.includes('server8.mp3quran.net'), 'privacy names the current audio host');
ok(sources.includes('www.mp3quran.net/api/v3/reciters?language=ar'), 'sources cite the official v3 API');
for (const reciter of catalog.reciters) {
  ok(sources.includes(reciter.server), `sources lists ${reciter.id} server`);
}

function header(res, name) {
  return res.headers.get(name) || res.headers.get(name.toLowerCase()) || '';
}

function isAudioType(type) {
  const value = type.toLowerCase();
  return value.includes('audio') || value.includes('mpeg') || value.includes('mp3') || value.includes('octet-stream');
}

async function checkUrl(url) {
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'SkillPostIslamic/1.0 (non-commercial audio check)' } });
  const headType = header(head, 'content-type');
  if (head.status === 200 && isAudioType(headType)) {
    return { method: 'HEAD', status: head.status, type: headType, bytes: header(head, 'content-length') };
  }
  const ranged = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'SkillPostIslamic/1.0 (non-commercial audio check)',
      Range: 'bytes=0-1023',
    },
  });
  const rangeType = header(ranged, 'content-type');
  const okStatus = ranged.status === 200 || ranged.status === 206;
  if (!okStatus || !isAudioType(rangeType)) {
    throw new Error(`${ranged.status} ${rangeType || 'no content-type'} (HEAD ${head.status} ${headType || 'no content-type'})`);
  }
  return { method: 'Range GET', status: ranged.status, type: rangeType, bytes: header(ranged, 'content-length') || header(ranged, 'content-range') };
}

console.log('\nHTTP checks for surah 001 and 114:');
for (const reciter of catalog.reciters) {
  for (const surah of [1, 114]) {
    const url = surahAudioUrl(surah, reciter);
    try {
      const result = await checkUrl(url);
      ok(true, `${reciter.id} ${String(surah).padStart(3, '0')} ${result.method} ${result.status} ${result.type} ${result.bytes} ${url}`);
    } catch (error) {
      ok(false, `${reciter.id} ${String(surah).padStart(3, '0')} ${url} -> ${error.message}`);
    }
  }
}

if (failed) {
  console.error(`\n${failed} reciter checks failed`);
  process.exit(1);
}
console.log('\nAll reciter checks passed');

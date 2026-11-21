/* نور الإسلام — MP3Quran ayat timing helpers (UMD). Source: https://www.mp3quran.net/api/v3/ayat_timing */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AyahTimings = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TIMING_API = 'https://www.mp3quran.net/api/v3/ayat_timing';

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function ayahTime(item, key) {
    if (!item || typeof item !== 'object') return NaN;
    var value = item[key];
    if (typeof value === 'string' && value.trim() !== '') value = Number(value);
    return typeof value === 'number' ? value : NaN;
  }

  /**
   * Keep ayah 1..N only. Ignore ayah 0 (intro / isti'adha).
   * Return a sorted list when the set is exactly 1..expectedCount with
   * finite, monotonic start times; otherwise null (caller must not guess).
   */
  function normalizeTimings(raw, expectedCount) {
    if (!Array.isArray(raw) || !Number.isInteger(expectedCount) || expectedCount < 1) return null;
    var items = [];
    for (var i = 0; i < raw.length; i++) {
      var row = raw[i];
      var ayah = row && typeof row.ayah === 'number' ? row.ayah : Number(row && row.ayah);
      if (!Number.isInteger(ayah) || ayah < 1) continue;
      var start = ayahTime(row, 'start_time');
      var end = ayahTime(row, 'end_time');
      if (!isFiniteNumber(start) || !isFiniteNumber(end) || end < start) return null;
      items.push({ ayah: ayah, start: start, end: end });
    }
    if (items.length !== expectedCount) return null;
    items.sort(function (a, b) { return a.ayah - b.ayah; });
    for (var n = 0; n < expectedCount; n++) {
      if (items[n].ayah !== n + 1) return null;
      if (n > 0 && items[n].start < items[n - 1].start) return null;
    }
    return items;
  }

  /**
   * Binary search: ayah whose start <= timeMs, if time still falls in that
   * ayah (or in a closed interval before the next start). Times are in ms.
   * Returns null before the first ayah, after the last ayah's end, or in a gap.
   */
  function findAyahAtTime(timings, timeMs) {
    if (!Array.isArray(timings) || timings.length === 0 || !isFiniteNumber(timeMs)) return null;
    if (timeMs < timings[0].start) return null;
    var lo = 0;
    var hi = timings.length - 1;
    var ans = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (timings[mid].start <= timeMs) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    var current = timings[ans];
    var next = timings[ans + 1];
    if (timeMs > current.end && (!next || timeMs < next.start)) return null;
    return current.ayah;
  }

  function timingUrl(surah, readId) {
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) return null;
    if (!Number.isInteger(readId) || readId < 1) return null;
    return TIMING_API + '?surah=' + surah + '&read=' + readId;
  }

  function reciterSupportsTiming(reciter) {
    return Boolean(reciter && reciter.has_ayat_timing === true && Number.isInteger(reciter.moshaf_id) && reciter.moshaf_id > 0);
  }

  return {
    TIMING_API: TIMING_API,
    normalizeTimings: normalizeTimings,
    findAyahAtTime: findAyahAtTime,
    timingUrl: timingUrl,
    reciterSupportsTiming: reciterSupportsTiming,
  };
});

# SkillPost — public Islamic site

Non-commercial: no ads, no selling, no accounts. Quran, adhkar, prayer times, and an empty sheikhs page until teachers consent.

The previous commercial app is preserved on branch `archive/legacy-app` and tag `legacy-app-2026-11-09` (commit 6405098).

## What is here
- `public/`: the site as static files.
  - `index.html`: home, Quran reader, adhkar, prayer/qibla/Hijri.
  - `sheikhs.html`, `sources.html`, `privacy.html`, `robots.txt`, `sitemap.xml`.
  - `data/quran/NNN.json`: 114 per-surah files (Tanzil Uthmani 1.1, verbatim, plus Jalalayn).
  - `fonts/amiri-regular.woff2`: Amiri, SIL OFL 1.1.
  - `praytimes.js`: PrayTimes 2.5, LGPLv3, unmodified.
  - `analytics.js` plus `/_vercel/insights/script.js` (cookieless Vercel Web Analytics).
- `next.config.ts`: clean URLs, 301 redirects from old app routes, CSP and cache headers.
- `app/api/[[...path]]`: old `/api/*` routes return 410 Gone.
- `app/not-found.tsx`: the 404 page.

Build: `npm ci && npx next build`.

## Analytics
Pages load `/_vercel/insights/script.js` (same origin, no cookies). If that script 404s in production, enable Web Analytics once in the Vercel project dashboard. No other analytics are included.

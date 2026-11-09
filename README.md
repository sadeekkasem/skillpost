# SkillPost — public Islamic site (preview branch `public-islamic-preview`)

Non-commercial: no ads, no selling, no accounts, no cookies. **Preview only. Not merged into main, and production/domain are unchanged.**

## What is here
- `public/`: the whole site as static files.
  - `index.html`: home, Quran reader, adhkar, prayer/qibla/Hijri, all hash routes.
  - `sources.html`, `privacy.html`, `robots.txt`, `sitemap.xml`.
  - `data/quran/NNN.json`: 114 per-surah files (Tanzil Uthmani 1.1 text, verbatim, with the Tanzil notice in each file, plus Jalalayn tafsir). A surah file is loaded only when the reader opens or that surah is chosen.
  - `fonts/amiri-regular.woff2`: Amiri, SIL OFL 1.1.
  - `img/*.webp`: images.
  - `praytimes.js`: PrayTimes 2.5, LGPLv3, unmodified.
  - `app.js`: the site script.
- `next.config.ts`: rewrites `/`, `/sources` and `/privacy` to the static files, and sets the CSP, cache and security headers.
- `app/not-found.tsx`: the 404 page. There is no server code, no env vars and no database.
- `supabase/` and `docs/` are legacy material from the old app. The build does not use them, and nothing in the database is changed.

Build: `npm ci && npx next build`. This works with the existing Vercel Next.js preset and needs no settings change.

## Analytics (NOT enabled)
There is a hook comment in `<head>` of each page. Options:
- **Vercel Web Analytics:** cookieless; free on Hobby up to 50,000 events/month; needs to be enabled in the dashboard.
- **Cloudflare Web Analytics:** cookieless; free; needs a Cloudflare account and the beacon script; the CSP must allow static.cloudflareinsights.com.
- **GoatCounter:** cookieless; free for reasonable public use; needs an account; also needs a CSP change.

Enable only after separate approval.

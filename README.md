# نور الإسلام — public Islamic site

The GitHub repository remains `sadeekkasem/skillpost`. The public site name is نور الإسلام, at `https://www.noorislamsite.com`.

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

## Phase 3 (this branch, not applied to production yet)

Server-rendered staff UI and an `islamic` schema for sheikh pages and lessons. Public reading pages stay static and do not talk to Supabase from the browser. Session cookies are refreshed only on `/login`, `/admin`, `/sheikh`, `/student`, and `/auth/*`.

- `supabase/migrations/20261109220000_islamic_schema.sql` — write-only file; do not apply until approved.
- `supabase/rollbacks/20261109220000_islamic_schema_rollback.sql` — drops the `islamic` schema and public wrappers only.
- Public `/sheikhs` lists published pages, or the original empty state when there are none.
- Public `/sheikhs/[slug]` uses a click-to-load player (`youtube-nocookie`) after a click. Nothing is requested from that host on page load.
- Private questions are not built.

Local checks:

```
npm run test:youtube
npm run test:rls
ISLAMIC_DEV_FIXTURES=1 npm run dev   # local staff UI with labelled test data only
```

`ISLAMIC_DEV_FIXTURES` must never be set on Vercel production.

### Environment variables (names only)

Needed when this is connected to a live project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server only, for sending auth invites)
- `NEXT_PUBLIC_SITE_URL` (used as the magic-link redirect origin)
- `ISLAMIC_AUTH_ENABLED` — set to `true` only when `/login` may send magic-link or OTP messages
- `ISLAMIC_SEND_INVITES` — set to `true` only when staff invitations should actually be emailed; otherwise invitations are stored and not emailed

Whether these already exist on the Vercel project is unknown without a Vercel login.

Redirect URLs to add in Supabase Auth when applying: `https://www.noorislamsite.com/auth/callback` and preview callback URLs as needed.

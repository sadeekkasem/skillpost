/* نور الإسلام — Service Worker.
   - الصفحات: الشبكة أولًا ثم النسخة المحفوظة ثم صفحة "بلا اتصال".
   - ملفات الموقع (CSS/JS/خطوط/صور): من الحفظ مع تحديث في الخلفية.
   - نصوص القرآن والحديث والأذكار: تُحفظ عند أول فتح لتعمل دون إنترنت.
   - لا يتدخل في: صفحات الدخول والإدارة ورفيق الحفظ، والإحصاءات، والطلبات الخارجية (الصوت). */
'use strict';
const VERSION = '20261125b';
const SHELL = 'noor-shell-' + VERSION;
const RUNTIME = 'noor-runtime-' + VERSION;
const DATA = 'noor-data-v1';
const PRECACHE = [
  '/', '/qibla', '/calendar', '/zakat', '/hadith', '/salawat', '/sources', '/privacy', '/offline.html',
  '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon-32.png',
  '/data/adhkar-extra.json?v=20261125a', '/data/reciters.json?v=20261121c', '/data/mushaf.json'
];
const BYPASS = [/^\/(login|admin|sheikh|student|auth|hifz|api)(\/|$)/, /^\/pv$/, /^\/published-content$/, /^\/_vercel\//, /^\/_next\/(data|webpack-hmr)/, /^\/hero-image$/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { credentials: 'same-origin' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('noor-') && k !== SHELL && k !== RUNTIME && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then((cache) => cache.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}
function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then((cache) => cache.match(req).then((hit) => hit || fetch(req).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; })));
}
function networkFirstPage(req) {
  return fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match(new URL(req.url).pathname === '/' ? '/' : req.url.split('#')[0]).then((h2) => h2 || caches.match('/offline.html'))));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((re) => re.test(url.pathname))) return;
  if (req.mode === 'navigate') { event.respondWith(networkFirstPage(req)); return; }
  if (url.pathname.startsWith('/data/')) { event.respondWith(url.pathname.startsWith('/data/hadith/daily/') ? staleWhileRevalidate(req, DATA) : cacheFirst(req, DATA)); return; }
  if (/\.(css|js|woff2|png|jpg|jpeg|webp|svg|ico|webmanifest|jsonld)$/.test(url.pathname)) { event.respondWith(staleWhileRevalidate(req, RUNTIME)); return; }
});

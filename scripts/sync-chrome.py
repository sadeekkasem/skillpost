#!/usr/bin/env python3
"""Sync the shared header nav, footer and head assets across the static pages in public/.
Run: python3 scripts/sync-chrome.py   (idempotent)"""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent / 'public'
V = '20261125a'
NAV = [
  ('/#home','home','الرئيسية'),
  ('/#quran-reader','quran-reader','القرآن'),
  ('/hifz','hifz','رفيق الحفظ'),
  ('/#adhkar-reader','adhkar-reader','الأذكار'),
  ('/#prayer-tools','prayer-tools','مواقيت الصلاة'),
  ('/qibla','qibla','القبلة'),
  ('/calendar','calendar','التقويم'),
  ('/hadith','hadith','الحديث'),
  ('/salawat','salawat','الصلاة على النبي'),
  ('/zakat','zakat','الزكاة'),
  ('/sheikhs','sheikhs','المشايخ'),
]
FOOT = [('/salawat','الصلاة على النبي ﷺ'),('/hadith','الحديث الشريف'),('/sheikhs','المشايخ'),('/sources','عن المنصة والمصادر'),('/privacy','الخصوصية')]
PAGES = {'index.html':None,'hadith.html':'hadith','salawat.html':'salawat','sources.html':None,'privacy.html':None,'sheikhs.html':'sheikhs','qibla.html':'qibla','calendar.html':'calendar','zakat.html':'zakat','offline.html':None}

def nav(current):
    links=''.join(f'<a href="{h}" data-nav="{i}"'+(' aria-current="page"' if i==current else '')+f'>{t}</a>' for h,i,t in NAV)
    return f'<nav id="primary-nav" aria-label="التنقل الرئيسي">{links}</nav>'
def footer():
    links=''.join(f'<a href="{h}">{t}</a>' for h,t in FOOT)
    return f'<footer><span>نور الإسلام · منصة غير تجارية: لا إعلانات ولا بيع</span><div class="footer-links">{links}</div><span>صورة الكعبة: Neo Evenger / Pexels</span></footer>'

for name,cur in PAGES.items():
    p=ROOT/name
    if not p.exists(): continue
    s=p.read_text()
    s=re.sub(r'<nav id="primary-nav".*?</nav>',lambda m:nav(cur),s,count=1,flags=re.S)
    s=re.sub(r'<footer>.*?</footer>',lambda m:footer(),s,count=1,flags=re.S)
    s=re.sub(r'<link rel="stylesheet" href="/style.css\?v=[^"]*">',f'<link rel="stylesheet" href="/style.css?v={V}">',s)
    s=re.sub(r'<meta name="theme-color" content="[^"]*">','<meta name="theme-color" content="#123F38">',s)
    if 'theme-init.js' not in s:
        s=s.replace('<link rel="stylesheet" href="/style.css',f'<script src="/theme-init.js?v={V}"></script><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/style.css',1)
    if '/ui.js' not in s:
        s=s.replace('</body>',f'<script src="/ui.js?v={V}" defer></script>\n</body>',1)
    s=re.sub(r'/ui\.js\?v=[^"]*',f'/ui.js?v={V}',s)
    s=re.sub(r'/theme-init\.js\?v=[^"]*',f'/theme-init.js?v={V}',s)
    p.write_text(s)
    print('synced',name)

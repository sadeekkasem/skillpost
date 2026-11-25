#!/usr/bin/env python3
"""End-to-end checks for the public pages (Playwright + Chrome). CSP is bypassed only so Playwright can poll the page.
Start the site first:  npx next build && npx next start -p 3100
Run:                   python3 scripts/test-e2e.py [base_url]"""
import asyncio, re, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3100'
fails = 0
def ok(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails += 1

IGNORED = ('/_vercel/insights', 'everyayah.com', 'mp3quran')

async def page_with_errors(ctx, path):
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and not any(x in m.text for x in IGNORED) and 'MIME type' not in m.text and '404' not in m.text else None)
    await pg.goto(BASE + path, wait_until='networkidle')
    return pg, errs

async def main():
    async with async_playwright() as p:
        exe = '/usr/bin/google-chrome'
        b = await p.chromium.launch(executable_path=exe, args=['--no-sandbox']) if __import__('os').path.exists(exe) else await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1280, 'height': 900}, timezone_id='Europe/Helsinki', locale='ar', bypass_csp=True)

        # Home: prayer panel
        pg, errs = await page_with_errors(ctx, '/')
        ok(await pg.locator('h1').count() == 1, 'home has exactly one <h1>')
        await pg.select_option('#pp-select', 'helsinki')
        await pg.wait_for_timeout(1200)
        slots = await pg.locator('#pp-strip .prayer-slot strong').all_inner_texts()
        ok(len(slots) == 6 and all(re.fullmatch(r'\d\d:\d\d', s) for s in slots), 'prayer strip shows six HH:MM times for Helsinki: ' + ' '.join(slots))
        cd = await pg.inner_text('#pp-countdown')
        ok(re.fullmatch(r'\d\d:\d\d:\d\d', cd) is not None, 'countdown ticks: ' + cd)
        ok('هلسنكي' in await pg.inner_text('#pp-city'), 'chosen city is shown and remembered')
        await pg.wait_for_function("document.getElementById('da-text').textContent.length>5")
        ok(len(await pg.inner_text('#da-text')) > 5 and 'سورة' in await pg.inner_text('#da-ref'), 'ayah of the day loads with its reference')
        await pg.wait_for_function("document.getElementById('dh-text').textContent.length>5")
        ok(len(await pg.inner_text('#dh-text')) > 10, 'hadith of the day loads')
        # theme toggle
        before = await pg.get_attribute('html', 'data-theme')
        await pg.click('#theme-toggle'); after = await pg.get_attribute('html', 'data-theme')
        ok(before != after and after in ('dark', 'light'), f'theme toggle switches {before} → {after}')
        await pg.reload(wait_until='networkidle')
        ok(await pg.get_attribute('html', 'data-theme') == after, 'theme choice persists after reload')
        ok(re.fullmatch(r'\d\d:\d\d', (await pg.locator('#pp-strip .prayer-slot strong').all_inner_texts() or [''])[0]) is not None, 'prayer city persists after reload')
        ok(not errs, 'home: no JS errors ' + str(errs[:3]))

        # Quran deep link, favourites, search
        await pg.goto(BASE + '/#quran-reader/2/255', wait_until='networkidle'); await pg.wait_for_timeout(800)
        ok('البقرة' in await pg.inner_text('#surah-heading') and '255' in await pg.inner_text('#selected-reference'), 'deep link opens al-Baqarah 255 with its tafsir')
        await pg.click('#ayah-fav'); await pg.wait_for_timeout(200)
        ok('الآية 255' in await pg.inner_text('#fav-list'), 'ayah added to favourites')
        await pg.fill('#quran-search-input', 'الصابرين'); await pg.click('#quran-search-form button[type=submit]')
        await pg.wait_for_function("document.querySelectorAll('#quran-search-results li').length>0", timeout=60000)
        n = await pg.locator('#quran-search-results li').count()
        ok(n >= 10, f'diacritics-insensitive search finds results ({n})')
        await pg.goto(BASE + '/#home', wait_until='networkidle')
        ok(not await pg.locator('#continue-card').is_hidden(), '"continue reading" card appears on home')

        # Adhkar: extra categories, counter persistence, favourites
        await pg.goto(BASE + '/#adhkar-reader/بعد الصلاة', wait_until='networkidle'); await pg.wait_for_timeout(600)
        cats = await pg.locator('#adhkar-list .status').all_inner_texts()
        ok(len(cats) > 5 and set(cats) == {'بعد الصلاة'}, f'adhkar deep link filters to after-prayer ({len(cats)} cards)')
        first = pg.locator('#adhkar-list .adhkar-card').first
        await first.locator('.dhikr-counter .button').first.click()
        await first.locator('.fav-toggle').click()
        await pg.reload(wait_until='networkidle'); await pg.wait_for_timeout(600)
        await pg.select_option('#adhkar-category', 'favorites'); await pg.wait_for_timeout(200)
        ok(await pg.locator('#adhkar-list .adhkar-card').count() == 1, 'favourite dhikr kept after reload')
        ok((await pg.locator('#adhkar-list output').first.inner_text()).startswith('1'), 'today\'s counter progress kept after reload')
        await pg.click('#tasbeeh-tap'); await pg.click('#tasbeeh-tap')
        ok(await pg.inner_text('#tasbeeh-count') == '2', 'tasbeeh counter increments')

        # Prayer tools page still works
        await pg.goto(BASE + '/#prayer-tools', wait_until='networkidle')
        await pg.select_option('#city-preset', 'mecca'); await pg.fill('#prayer-date', '2026-11-25'); await pg.click('#prayer-form button[type=submit]')
        ok(await pg.locator('#prayer-times .prayer-time').count() == 6, 'prayer tools calculation still renders 6 events')

        # Qibla
        pg2, errs2 = await page_with_errors(ctx, '/qibla')
        await pg2.select_option('#qibla-city', 'helsinki'); await pg2.wait_for_timeout(200)
        bearing = float(re.search(r'([\d.]+)°', await pg2.inner_text('#qibla-bearing')).group(1))
        ok(140 < bearing < 160, f'Helsinki qibla bearing is plausible ({bearing}°)')
        await pg2.select_option('#qibla-city', 'jakarta'); await pg2.wait_for_timeout(200)
        bearing = float(re.search(r'([\d.]+)°', await pg2.inner_text('#qibla-bearing')).group(1))
        ok(290 < bearing < 300, f'Jakarta qibla bearing is plausible ({bearing}°)')
        ok(not errs2, 'qibla: no JS errors ' + str(errs2[:3]))

        # Calendar
        pg3, errs3 = await page_with_errors(ctx, '/calendar')
        t1 = await pg3.inner_text('#cal-title'); await pg3.click('#cal-next'); t2 = await pg3.inner_text('#cal-title')
        ok(t1 != t2, f'calendar navigates months ({t1} → {t2})')
        ok(await pg3.locator('#cal-events li').count() == 8, 'calendar lists 8 upcoming occasions')
        async with pg3.expect_download() as dl: await pg3.locator('#cal-events li button').first.click()
        ok((await dl.value).suggested_filename.endswith('.ics'), '"add to my calendar" downloads an .ics file')
        ok(not errs3, 'calendar: no JS errors ' + str(errs3[:3]))

        # Zakat
        pg4, errs4 = await page_with_errors(ctx, '/zakat')
        await pg4.fill('#z-gold-price', '300'); await pg4.fill('#z-cash', '30000'); await pg4.click('#zakat-form button[type=submit]')
        ok('750' in await pg4.inner_text('#z-result'), 'zakat on 30000 at gold nisab 25500 = 750')
        ok(not errs4, 'zakat: no JS errors ' + str(errs4[:3]))

        # Hadith deep link
        pg5, errs5 = await page_with_errors(ctx, '/hadith?id=10948')
        await pg5.wait_for_selector('.hadith-card.is-target', timeout=30000)
        ok('دبر كل صلاة' in (await pg5.inner_text('.hadith-card.is-target')).replace('\u064e','').replace('\u0650','').replace('\u064f','').replace('\u0652','').replace('\u0651',''), 'hadith ?id= shows the requested hadith first')
        ok(not errs5, 'hadith: no JS errors ' + str(errs5[:3]))

        # PWA: manifest + service worker + offline
        pg6, _ = await page_with_errors(ctx, '/')
        await pg6.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null || (navigator.serviceWorker.ready.then(()=>true))", timeout=15000)
        await pg6.reload(wait_until='networkidle'); await pg6.wait_for_timeout(1500)
        ok(await pg6.evaluate("!!navigator.serviceWorker.controller"), 'service worker controls the page')
        await ctx.set_offline(True)
        await pg6.reload(wait_until='domcontentloaded'); await pg6.wait_for_timeout(800)
        ok(await pg6.locator('#home-title').count() == 1, 'home page opens offline from the cache')
        await pg6.goto(BASE + '/never-visited-page', wait_until='domcontentloaded')
        ok('غير متصل' in await pg6.inner_text('body'), 'unvisited page offline shows the offline page')
        await ctx.set_offline(False)

        # Mobile layout: no horizontal overflow
        m = await b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, bypass_csp=True)
        for path in ['/', '/#quran-reader', '/#adhkar-reader', '/#prayer-tools', '/qibla', '/calendar', '/zakat', '/hadith', '/salawat', '/sources', '/privacy']:
            mp = await m.new_page(); await mp.goto(BASE + path, wait_until='networkidle')
            sw = await mp.evaluate('document.documentElement.scrollWidth')
            ok(sw <= 376, f'mobile {path}: no horizontal scroll (scrollWidth {sw})')
            ok(await mp.locator('.bottom-nav').is_visible(), f'mobile {path}: bottom navigation visible')
            await mp.close()
        await b.close()
    print(f'{fails} failed' if fails else 'all e2e checks passed')
    sys.exit(1 if fails else 0)

asyncio.run(main())

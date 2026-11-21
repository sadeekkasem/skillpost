#!/usr/bin/env python3
"""Mobile browser check of رفيق الحفظ against a local Next fixture session."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROME = Path("/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome")
OUT = Path("/workspace/noor-hifz-companion-mobile.png")
PORT = int(os.environ.get("HIFZ_UI_PORT", "3101"))
URL = f"http://127.0.0.1:{PORT}/hifz"

def wait_http(url: str, timeout: float = 60) -> None:
    import urllib.request
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as res:
                if res.status == 200:
                    return
        except Exception as exc:
            last = exc
        time.sleep(0.4)
    raise RuntimeError(f"server did not start: {last}")

def main() -> None:
    env = os.environ.copy()
    env["ISLAMIC_DEV_FIXTURES"] = "1"
    env.pop("VERCEL_ENV", None)
    env["PORT"] = str(PORT)
    log = open("/tmp/hifz-next.log", "w", encoding="utf-8")
    proc = subprocess.Popen(
        ["npx", "next", "dev", "-p", str(PORT), "-H", "127.0.0.1"],
        cwd=str(ROOT),
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        wait_http(URL, timeout=90)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=str(CHROME))
            context = browser.new_context(viewport={"width": 390, "height": 844}, locale="ar")
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(URL, wait_until="domcontentloaded", timeout=45000)
            page.get_by_role("heading", name="رفيق الحفظ").wait_for(timeout=20000)
            # Fixture session skips intro and shows the plan wizard
            page.get_by_text("حفظ جديد", exact=False).wait_for(timeout=15000)
            page.get_by_role("button", name="التالي").click()
            page.get_by_text("5 آيات").wait_for()
            page.get_by_role("button", name="التالي").click()
            # Include Saturday (today in the 2026-11-21 Helsinki fixture window may vary; select all days)
            for name in ("السبت", "الأحد"):
                label = page.locator(".hifz-weekdays label", has_text=name).first
                if label.count() and "is-selected" not in (label.get_attribute("class") or ""):
                    label.click()
            page.get_by_role("button", name="احفظ الخطة").click()
            page.locator("#hifz-today").wait_for(timeout=20000)
            playable = page.get_by_role("button", name="تم الحفظ")
            if playable.count():
                playable.click()
                page.get_by_text("أحسنت", exact=False).wait_for(timeout=15000)
            else:
                # Rest day or already recorded: still require the dashboard
                page.get_by_text("التقدّم").wait_for(timeout=10000)
            page.locator(".hifz-streak").wait_for()
            page.locator(".juz-grid").wait_for()
            page.evaluate("() => document.getElementById('hifz-today')?.scrollIntoView({block:'start'})")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT), full_page=False)
            print("screenshot", OUT, "size", OUT.stat().st_size)
            if errors:
                raise SystemExit("page errors: " + " | ".join(errors))
            print("ok - mobile hifz dashboard")
            browser.close()
    finally:
        try:
            log.close()
        except Exception:
            pass
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
    print("All hifz UI checks passed")

if __name__ == "__main__":
    main()

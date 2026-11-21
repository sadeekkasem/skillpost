#!/usr/bin/env python3
"""Regression test: Quran play/pause/resume/stop button state, mobile and desktop."""
from __future__ import annotations

import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CHROME = Path("/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def log_message(self, format, *args):  # noqa: A003
        return


def start_server():
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    httpd.allow_reuse_address = True
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    port = httpd.server_address[1]
    return httpd, f"http://127.0.0.1:{port}/index.html#quran-reader"


def run_viewport(page, label: str):
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    console_errors = []
    page.on(
        "console",
        lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
    )

    def play_btn():
        return page.locator("#audio-play")

    def pause_btn():
        return page.locator("#audio-pause")

    def stop_btn():
        return page.locator("#audio-stop")

    def status():
        return page.locator("#audio-status").inner_text()

    page.locator("#reciter-select").wait_for(state="visible", timeout=15000)
    page.wait_for_function(
        "() => !document.getElementById('audio-play').disabled",
        timeout=15000,
    )
    page.locator("#verse-text .ayah, #verse-text .ayah-copy").first.wait_for(timeout=15000)

    assert not errors, f"{label}: page errors before play: {errors}"
    assert play_btn().is_enabled(), f"{label}: play should start enabled"
    assert not pause_btn().is_enabled(), f"{label}: pause should start disabled"
    assert not stop_btn().is_enabled(), f"{label}: stop should start disabled"
    initial_status = status()

    play_btn().click()
    page.wait_for_function(
        "() => !document.getElementById('audio-pause').disabled",
        timeout=20000,
    )
    assert pause_btn().is_enabled(), f"{label}: pause should enable after play"
    assert stop_btn().is_enabled(), f"{label}: stop should enable after play"
    assert not play_btn().is_enabled(), f"{label}: play should disable while playing"
    assert status() != initial_status, f"{label}: status should change after play"

    pause_btn().click()
    page.wait_for_function(
        "() => !document.getElementById('audio-play').disabled && document.getElementById('audio-pause').disabled",
        timeout=10000,
    )
    assert play_btn().is_enabled(), f"{label}: play should enable after pause"
    assert not pause_btn().is_enabled(), f"{label}: pause should disable after pause"
    assert stop_btn().is_enabled(), f"{label}: stop should stay enabled after pause"
    assert "متوقفة" in status() or "توقف" in status() or "متابعة" in status(), f"{label}: unexpected pause status: {status()}"

    play_btn().click()
    page.wait_for_function(
        "() => !document.getElementById('audio-pause').disabled",
        timeout=15000,
    )
    assert pause_btn().is_enabled(), f"{label}: pause should enable after resume"

    stop_btn().click()
    page.wait_for_function(
        "() => document.getElementById('audio-pause').disabled && document.getElementById('audio-stop').disabled",
        timeout=10000,
    )
    assert play_btn().is_enabled(), f"{label}: play should enable after stop"
    assert not pause_btn().is_enabled(), f"{label}: pause should disable after stop"
    assert not stop_btn().is_enabled(), f"{label}: stop should disable after stop"

    # Switch reciter and surah, then play again
    page.select_option("#reciter-select", "abdulbasit-abdulsamad")
    page.wait_for_timeout(200)
    page.select_option("#surah-select", "0")  # remain/reset Fatiha
    play_btn().click()
    page.wait_for_function(
        "() => !document.getElementById('audio-pause').disabled",
        timeout=15000,
    )
    ayah = page.locator("#verse-text .ayah").nth(1)
    if ayah.count():
        ayah.locator(".ayah-copy").click()
        page.wait_for_timeout(500)
        assert pause_btn().is_enabled() or play_btn().is_enabled(), f"{label}: player should stay usable after ayah click"
    stop_btn().click()
    page.wait_for_timeout(200)

    assert not errors, f"{label}: page errors during audio controls: {errors}"
    print(f"ok - {label} play/pause/resume/stop")


def main():
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/home/box/.cache/ms-playwright")
    httpd, url = start_server()
    failed = 0
    try:
        with sync_playwright() as p:
            launch_args = {"headless": True, "args": ["--autoplay-policy=no-user-gesture-required"]}
            if CHROME.exists():
                launch_args["executable_path"] = str(CHROME)
            browser = p.chromium.launch(**launch_args)
            for name, size in (("mobile", {"width": 390, "height": 844}), ("desktop", {"width": 1280, "height": 800})):
                context = browser.new_context(viewport=size, locale="ar")
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                try:
                    run_viewport(page, name)
                except Exception as exc:  # noqa: BLE001
                    failed += 1
                    print(f"not ok - {name}: {exc}", file=sys.stderr)
                    shot = Path("/tmp") / f"quran-player-{name}-fail.png"
                    try:
                        page.screenshot(path=str(shot), full_page=False)
                        print(f"saved failure shot {shot}", file=sys.stderr)
                    except Exception:
                        pass
                context.close()
            browser.close()
    finally:
        httpd.shutdown()
    if failed:
        print(f"{failed} viewport checks failed", file=sys.stderr)
        return 1
    print("All quran player control checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

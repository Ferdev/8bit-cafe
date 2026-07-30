#!/usr/bin/env python3
"""Click through chip.cafe like a user and report what the audio element does."""
import sys
import time

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/"

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/etc/profiles/per-user/fer/bin/chromium",
        headless=True,
        args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
    )
    page = browser.new_page()
    errors = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("requestfailed", lambda r: errors.append(f"REQFAIL: {r.url} {r.failure}"))

    page.goto(URL)
    page.wait_for_timeout(1000)

    # boot -> lobby
    page.click(".boot")
    page.wait_for_timeout(500)

    cards = page.query_selector_all(".room-card")
    print(f"room cards: {len(cards)}")

    which = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cards[which].click()
    page.wait_for_timeout(4000)

    state = page.evaluate(
        """() => {
            const a = document.querySelector('audio');
            if (!a) return {audio: null};
            return {
                audio: true,
                src: a.currentSrc || a.src,
                paused: a.paused,
                currentTime: a.currentTime,
                readyState: a.readyState,
                networkState: a.networkState,
                error: a.error ? {code: a.error.code, message: a.error.message} : null,
                autoplayAttr: a.getAttribute('autoplay'),
            };
        }"""
    )
    print("audio state:", state)
    page.screenshot(path="/tmp/pw-room.png")
    print("console:", errors or "clean")
    browser.close()

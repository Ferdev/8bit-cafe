#!/usr/bin/env python3
"""Full flow test: boot -> room -> check playing + status text -> pause -> play."""
import sys

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/"
which = int(sys.argv[1]) if len(sys.argv) > 1 else 0

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/etc/profiles/per-user/fer/bin/chromium",
        headless=True,
        args=["--no-sandbox"],
    )
    page = browser.new_page()
    msgs = []
    page.on("console", lambda m: msgs.append(f"{m.type}: {m.text}") if m.type == "error" else None)

    page.goto(URL)
    page.wait_for_timeout(800)
    page.click(".boot")
    page.wait_for_timeout(400)
    page.query_selector_all(".room-card")[which].click()
    page.wait_for_timeout(10000)

    state = page.evaluate(
        """() => {
            const a = document.querySelector('audio');
            return {
                paused: a ? a.paused : 'NO AUDIO EL',
                currentTime: a ? a.currentTime : null,
                sources: a ? [...a.querySelectorAll('source')].map(s => s.src) : [],
                status: document.querySelector('.stream-status')?.textContent,
                btn: document.querySelector('.play-btn')?.textContent,
            };
        }"""
    )
    print("after enter:", state)

    # pause
    page.click(".play-btn")
    page.wait_for_timeout(600)
    print("after pause:", page.evaluate(
        "() => ({audio: !!document.querySelector('audio'), status: document.querySelector('.stream-status')?.textContent})"))

    # resume
    page.click(".play-btn")
    page.wait_for_timeout(8000)
    print("after resume:", page.evaluate(
        """() => {
            const a = document.querySelector('audio');
            return {paused: a ? a.paused : 'NO AUDIO EL', currentTime: a?.currentTime,
                    status: document.querySelector('.stream-status')?.textContent};
        }"""))
    print("console errors:", msgs or "none")
    browser.close()

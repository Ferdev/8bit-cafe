#!/usr/bin/env python3
"""Deeper audio diagnosis for one room (index as argv[1])."""
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
    page.on("console", lambda m: msgs.append(f"{m.type}: {m.text}"))
    page.on("requestfailed", lambda r: msgs.append(f"REQFAIL: {r.url} -> {r.failure}"))
    page.on("response", lambda r: msgs.append(f"RESP {r.status} {r.url}") if "ogg" in r.url or "stream" in r.url else None)

    page.goto(URL)
    page.wait_for_timeout(800)
    page.click(".boot")
    page.wait_for_timeout(400)
    page.query_selector_all(".room-card")[which].click()
    page.wait_for_timeout(8000)

    state = page.evaluate(
        """async () => {
            const a = document.querySelector('audio');
            if (!a) return {audio: null};
            let playResult = 'not-tried';
            if (a.paused) {
                try { await a.play(); playResult = 'play() ok'; }
                catch (e) { playResult = 'play() REJECTED: ' + e.name + ': ' + e.message; }
            }
            await new Promise(r => setTimeout(r, 2000));
            return {
                src: a.currentSrc || a.src,
                paused: a.paused,
                currentTime: a.currentTime,
                readyState: a.readyState,
                networkState: a.networkState,
                error: a.error ? {code: a.error.code, message: a.error.message} : null,
                playResult,
            };
        }"""
    )
    print("audio state:", state)
    for m in msgs:
        print(" ", m)
    browser.close()

"""Anime Scout: Where to watch. Needs `npm run dev` in web/ (the Worker can be off: Japan is simulated).

    python tests/browser/watch_check.py <folder for screenshots>
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:5185/"
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def open_show(page, query):
    page.locator("#search-input").fill(query)
    page.wait_for_selector(".search-row")
    page.locator(".search-row").first.click()
    page.wait_for_selector(".dialog")
    page.wait_for_timeout(1200)
    return page.locator(".dialog").inner_text()


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1300, "height": 950}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    pg.evaluate("localStorage.clear()")
    pg.goto(URL + "?global")
    pg.wait_for_selector("article.card", timeout=60000)

    text = open_show(pg, "fullmetal alchemist brotherhood")
    check("outside Japan: AniList's streaming links", "Where to watch" in text and ("Crunchyroll" in text or "Netflix" in text or "Hulu" in text), text[text.find("Where to watch"):][:120].replace("\n", " "))
    pg.keyboard.press("Escape")

    # Japan, server not answering (no TMDB key yet): a clear note, the other links still there
    pg.route("**/api/watch**", lambda route: route.fulfill(status=503, json={"error": "no_key"}))
    pg.evaluate("localStorage.setItem('anime-scout.settings', JSON.stringify({region: 'jp'}))")
    pg.goto(URL + "?jp1")
    pg.wait_for_selector("article.card", timeout=60000)
    text = open_show(pg, "fullmetal alchemist brotherhood")
    check("Japan, no key yet: says it's coming", "coming soon" in text and "Outside Japan" in text)
    pg.keyboard.press("Escape")

    # Japan, the server answering
    pg.unroute("**/api/watch**")
    pg.route("**/api/watch**", lambda route: route.fulfill(status=200, json={
        "region": "JP", "link": "https://www.themoviedb.org/tv/31911/watch?locale=JP",
        "providers": [{"name": "dアニメストア", "kind": "flatrate", "logo": None}, {"name": "U-NEXT", "kind": "flatrate", "logo": None},
                      {"name": "Amazon Video", "kind": "buy", "logo": None}]}))
    pg.goto(URL + "?jp2")
    pg.wait_for_selector("article.card", timeout=60000)
    text = open_show(pg, "fullmetal alchemist brotherhood")
    check("Japan: dアニメストア and U-NEXT", "dアニメストア" in text and "U-NEXT" in text)
    check("Japan: buying is marked", "Buy" in text)
    check("TMDB / JustWatch credit shown", "JustWatch" in text)
    pg.screenshot(path=shots / "watch-jp.png")
    check("no page errors", not errors, errors[:2])
    b.close()
print(f"{sum(res)}/{len(res)} passed")

"""Games on the combined site: For you, rating a game, your saved ratings, the platform switch, Steam sales with
prices, the details popup, Update now (on the PC only), phone layout. Dev server on 5185 by default.

    python tests/browser/games_check.py <folder for screenshots>
    set SITE=https://anime-scout.nomikai-scout-worker.workers.dev   (checks the live site; Update now must be absent)
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
SITE = os.environ.get("SITE", "http://localhost:5185").rstrip("/")  # SITE=https://... checks the live site
LIVE = not SITE.startswith("http://localhost")
URL = SITE + "/games/"
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def saved_games(page):
    text = page.evaluate("localStorage.getItem('game-scout.ratings')")
    return {row["game"]: row["rating"] for row in json.loads(text)["rows"]} if text else {}


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1366, "height": 900}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))

    # A first visit: nothing rated yet
    pg.goto(URL)
    pg.evaluate("localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    check("For you: a start page with games to rate", pg.locator("article.card").count() > 5 and
          "Start with games you know" in pg.locator("main").inner_text())

    # Rate Portal 2 from the search box
    pg.locator("#search-input").fill("Portal 2")
    pg.wait_for_selector(".search-row")
    pg.locator(".search-row").first.click()
    pg.wait_for_selector(".dialog")
    check("search → the details popup opens", "Portal 2" in pg.locator(".dialog-title").inner_text(), pg.locator(".dialog-title").inner_text())
    pg.locator(".dialog .tier-buttons button", has_text="Liked").first.click()
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(500)
    check("the rating is saved under game-scout.ratings", saved_games(pg).get("steam:620") == "liked", saved_games(pg))
    pg.wait_for_selector("h1:has-text('Recommended for you')", timeout=30000)
    # The "players also liked" links (a few MB) may still be downloading on a slow connection: wait for them
    t0 = pg.evaluate("performance.now()")
    pg.wait_for_function("document.querySelectorAll('main article.card').length > 5", timeout=60000)
    check("picks appear after one like", True, f"{(pg.evaluate('performance.now()') - t0) / 1000:.1f}s after the heading")
    pg.screenshot(path=shots / "games-1-picks.png")
    pg.locator(".sidebar a.nav-link", has_text="My games").first.click()
    pg.wait_for_timeout(500)
    check("My games → /games/liked lists it", pg.evaluate("location.pathname") == "/games/liked" and
          "Portal 2" in pg.locator("main").inner_text(), pg.evaluate("location.pathname"))

    # Ratings saved before the page loads (your old Game Scout list) show up
    rows = [{"game": "steam:400", "rating": "loved", "at": "2026-10-01T00:00:00.000Z"},
            {"game": "steam:105600", "rating": "liked", "at": "2026-10-01T00:00:00.000Z"}]
    pg.evaluate(f"localStorage.setItem('game-scout.ratings', JSON.stringify({{version: 1, rows: {json.dumps(rows)}}}))")
    pg.goto(SITE + "/games/liked")
    pg.wait_for_selector("article.card", timeout=60000)
    text = pg.locator("main").inner_text()
    check("ratings saved before loading show on My games", "Portal" in text and "Terraria" in text)

    # Platforms
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    pg.get_by_role("radio", name="PlayStation").first.click()
    pg.wait_for_timeout(800)
    ps = pg.locator("main").inner_text()
    pg.get_by_role("radio", name="Xbox").first.click()
    pg.wait_for_timeout(800)
    xb = pg.locator("main").inner_text()
    check("PlayStation and Xbox each show their own picks", "PlayStation" in ps and "Xbox" in xb and ps != xb)
    check("Switch is marked Soon", "Soon" in pg.locator(".sidebar").inner_text())
    pg.get_by_role("radio", name="Steam").first.click()

    # Steam sales: deep link, prices, reload, On sale filter
    pg.goto(SITE + "/games/sales")
    pg.wait_for_selector(".price-now", timeout=60000)
    check("/games/sales lists games with prices", pg.locator(".price-now").count() > 5 and pg.locator(".price-cut").count() > 5)
    pg.reload()
    pg.wait_for_selector(".price-now", timeout=60000)
    check("...and survives a reload", pg.locator("h1").first.inner_text() == "Steam sales")
    pg.screenshot(path=shots / "games-2-sales.png")
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    pg.get_by_label("On sale now").check()
    pg.wait_for_timeout(800)
    cards = pg.locator("article.card").count()
    with_cut = pg.locator("article.card .price-cut").count()
    check("On sale now: every pick shows a discount", cards > 0 and with_cut == cards, f"{with_cut}/{cards}")
    pg.get_by_label("On sale now").uncheck()

    # Update now: only on the PC (the dev server runs it)
    pg.goto(SITE + "/games/settings")
    pg.wait_for_selector("h1")
    has_update = pg.get_by_role("button", name="Update now").count() > 0
    check("Update now: on the PC, not on the live site", has_update != LIVE, f"shown={has_update}")
    check("no page errors", not errors, errors[:2])

    # Phone
    phone = b.new_page(viewport={"width": 390, "height": 844}, locale="en-US")
    for path in ["/games/", "/games/sales"]:
        phone.goto(SITE + path)
        phone.wait_for_selector("article.card", timeout=60000)
        wide = phone.evaluate("document.documentElement.scrollWidth")
        check(f"phone {path}: no sideways scroll", wide <= 390, f"{wide}px")
    phone.screenshot(path=shots / "games-3-phone-sales.png")
    phone.get_by_role("button", name="Open menu").click()
    phone.wait_for_timeout(400)
    check("phone: ☰ opens the drawer", phone.locator(".drawer").is_visible())
    b.close()
print(f"{sum(res)}/{len(res)} passed")

"""Anime Scout site check (dev server on 5185)."""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("SITE", "http://localhost:5185").rstrip("/") + "/anime/"  # SITE=https://... checks the live site
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def rate(page, title_part, tier="Liked it"):
    card = page.locator("article.card", has=page.locator(".card-title", has_text=title_part)).first
    card.locator(".rate-trigger").click()
    page.get_by_role("menuitem", name=tier).click()
    page.wait_for_timeout(300)


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1400, "height": 950}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_selector("article.card", timeout=60000)
    check("start grid of well-known anime", pg.locator("article.card").count() >= 20, pg.locator("h1").inner_text())
    covers = pg.locator("article.card img").count()
    check("covers load", covers > 10, f"{covers} images")
    pg.screenshot(path=shots / "1-start.png")

    titles = pg.locator("article.card .card-title").all_inner_texts()
    for t in titles[:3]:
        rate(pg, t)
    pg.wait_for_timeout(1500)
    h1 = pg.locator("h1").first.inner_text()
    check("picks appear after liking", "Recommended" in h1, h1)
    check("match % and why on cards", pg.locator(".match-badge").count() > 5 and pg.locator(".card-reason").count() > 5,
          pg.locator(".card-reason").first.inner_text())
    check("start strip stays below until 10 ratings", pg.locator(".start-strip").count() == 1)
    pg.screenshot(path=shots / "2-picks.png")

    first_fans = pg.locator("article.card .card-title").first.inner_text()
    top8 = pg.locator("article.card .card-title").all_inner_texts()[:8]
    pg.get_by_role("radio", name="More like these").click()
    pg.wait_for_timeout(800)
    first_tags = pg.locator("article.card .card-title").first.inner_text()
    check("More like these gives other picks", first_tags != first_fans, f"{first_fans} -> {first_tags}")
    pg.get_by_role("radio", name="Fans also liked").click()

    pg.locator("#gems").fill("1")
    pg.wait_for_timeout(800)
    gems8 = pg.locator("article.card .card-title").all_inner_texts()[:8]
    check("hidden gems slider changes the picks", len(set(gems8) - set(top8)) >= 2, f"new in top 8: {sorted(set(gems8) - set(top8))}")
    pg.locator("#gems").fill("0")

    pg.locator("#search-input").fill("monster")
    pg.wait_for_selector(".search-row")
    top = pg.locator(".search-row .search-title").first.inner_text()
    check("search: 'monster' finds Monster first", top == "Monster", top)
    pg.keyboard.press("Escape")

    pg.locator("#search-input").fill("fullmetal alchemist brotherhood")
    pg.wait_for_selector(".search-row")
    pg.locator(".search-row").first.click()
    pg.wait_for_selector(".dialog")
    dialog = pg.locator(".dialog").inner_text()
    check("popup shows other versions", "Other versions" in dialog and "2003" in dialog)
    pg.screenshot(path=shots / "3-dialog.png")
    pg.keyboard.press("Escape")

    pg.goto(URL + "settings")
    pg.get_by_role("radio", name="日本語").first.click()
    pg.goto(URL)
    pg.wait_for_timeout(1000)
    check("Japanese UI", "おすすめ" in pg.locator("body").inner_text())
    pg.screenshot(path=shots / "4-ja.png")
    check("no page errors", not errors, errors[:2])

    phone = b.new_page(viewport={"width": 390, "height": 844})
    phone.goto(URL)
    phone.wait_for_selector("article.card", timeout=60000)
    check("phone: no sideways scroll", phone.evaluate("document.documentElement.scrollWidth") <= 390)
    phone.screenshot(path=shots / "5-phone.png")
    b.close()
print(f"{sum(res)}/{len(res)} passed")

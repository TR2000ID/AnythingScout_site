"""The combined site's frame: service bar (Games · Anime · Manga & Comics), Soon pages, which section "/" opens,
old Anime Scout links, deep links, no reloads between pages, phone layout. Dev server on 5185.

    python tests/browser/shell_check.py <folder for screenshots>
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
SITE = "http://localhost:5185"
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def path(page):
    return page.evaluate("location.pathname + location.search + location.hash")


def tabs(page):
    return page.locator(".service-tabs a").all_inner_texts()


def tab_names(page):
    # the "Soon" pill sits inside the tab: keep only the section's name
    return [page.locator(".service-tabs a").nth(i).locator(".service-name").inner_text() for i in range(len(tabs(page)))]


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1366, "height": 900}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))

    # First visit, nothing saved: Anime is the only ready section, so "/" opens it
    pg.goto(SITE + "/")
    pg.evaluate("localStorage.clear()")
    pg.goto(SITE + "/")
    pg.wait_for_selector("article.card", timeout=60000)
    check("/ with nothing saved -> /anime/", path(pg) == "/anime/", path(pg))
    check("service bar: Games, Anime, Manga & Comics in that order",
          pg.locator(".service-bar").count() == 1 and tab_names(pg) == ["Games", "Anime", "Manga & Comics"], tab_names(pg))
    check("Anime is the current tab", pg.locator(".service-tabs a[aria-current=page]").inner_text().startswith("Anime"))
    pg.screenshot(path=shots / "shell-1-anime.png")

    # Tabs
    pg.evaluate("window.__noReload = 1")
    pg.locator(".service-tabs a", has_text="Games").click()
    pg.wait_for_timeout(300)
    body = pg.locator("body").inner_text()
    check("Games tab -> /games/ with the Soon text", path(pg) == "/games/" and "moving in next" in body, path(pg))
    pg.screenshot(path=shots / "shell-2-games-soon.png")
    pg.locator(".service-tabs a", has_text="Anime").click()
    pg.wait_for_selector("article.card")
    check("Anime tab -> back with cards", path(pg) == "/anime/" and pg.locator("article.card").count() > 0, path(pg))
    pg.locator(".service-tabs a", has_text="Manga").click()
    pg.wait_for_timeout(300)
    check("Manga & Comics tab -> /manga/ with the Soon text",
          path(pg) == "/manga/" and "Manga & Comics is coming" in pg.locator("body").inner_text(), path(pg))
    check("switching tabs didn't reload the page", pg.evaluate("window.__noReload") == 1)

    # Old Anime Scout links
    pg.goto(SITE + "/#/liked")
    pg.wait_for_timeout(500)
    check("/#/liked -> /anime/liked", path(pg) == "/anime/liked", path(pg))
    pg.goto(SITE + "/?cal#/liked")
    pg.wait_for_timeout(500)
    check("/?cal#/liked -> /anime/liked?cal", path(pg) == "/anime/liked?cal", path(pg))

    # Which section "/" opens
    pg.goto(SITE + "/manga/")
    pg.wait_for_timeout(300)
    pg.goto(SITE + "/")
    pg.wait_for_timeout(500)
    check("after /manga/ (not ready), / -> /anime/", path(pg) == "/anime/", path(pg))
    pg.goto(SITE + "/anime/liked")
    pg.wait_for_timeout(300)
    pg.goto(SITE + "/")
    pg.wait_for_timeout(500)
    check("after /anime/liked, / -> /anime/", path(pg) == "/anime/", path(pg))
    pg.goto(SITE + "/foo")
    pg.wait_for_timeout(500)
    check("unknown address /foo -> a section, not a blank page", path(pg) == "/anime/", path(pg))
    pg.goto(SITE + "/anime/nope")
    pg.wait_for_selector("article.card", timeout=60000)
    check("unknown Anime page -> For you", pg.locator("article.card").count() > 0)

    # Sidebar links change the page without loading it again
    pg.goto(SITE + "/anime/")
    pg.wait_for_selector("article.card", timeout=60000)
    pg.evaluate("window.__noReload = 1")
    for name, want in [("My list", "/anime/liked"), ("Settings", "/anime/settings"), ("For you", "/anime/")]:
        pg.locator(".sidebar a.nav-link", has_text=name).first.click()
        pg.wait_for_timeout(300)
        check(f"sidebar {name} -> {want}", path(pg) == want, path(pg))
    check("sidebar links didn't reload the page", pg.evaluate("window.__noReload") == 1)
    pg.go_back()
    pg.wait_for_timeout(300)
    check("Back goes to the previous page", path(pg) == "/anime/settings", path(pg))

    # Reload on a deep link
    pg.goto(SITE + "/anime/settings")
    pg.reload()
    pg.wait_for_timeout(800)
    check("reload on /anime/settings shows Settings", pg.get_by_role("heading", name="Settings").count() > 0)
    pg.locator(".sidebar a.nav-link", has_text="For you").first.click()
    pg.wait_for_selector("article.card", timeout=60000)
    check("...and the cards appear on For you", pg.locator("article.card").count() > 0)

    # Japanese: the tabs follow Anime's language setting
    pg.goto(SITE + "/anime/settings")
    pg.get_by_role("radio", name="日本語").first.click()
    pg.wait_for_timeout(300)
    check("日本語: tabs read ゲーム, アニメ, マンガ・コミック", tab_names(pg) == ["ゲーム", "アニメ", "マンガ・コミック"], tab_names(pg))
    pg.screenshot(path=shots / "shell-3-ja.png")
    pg.evaluate("localStorage.removeItem('anime-scout.settings')")
    check("no page errors", not errors, errors[:2])

    # Phone
    phone = b.new_page(viewport={"width": 390, "height": 844}, locale="en-US")
    phone.goto(SITE + "/anime/")
    phone.wait_for_selector("article.card", timeout=60000)
    wide = phone.evaluate("document.documentElement.scrollWidth")
    check("phone /anime/: no sideways scroll", wide <= 390, f"{wide}px")
    check("phone: the Soon pills are hidden", not phone.locator(".service-soon").first.is_visible())
    phone.screenshot(path=shots / "shell-4-phone-anime.png")
    phone.get_by_role("button", name="Open menu").click()
    phone.wait_for_timeout(400)
    check("phone: ☰ opens the drawer", phone.locator(".drawer").is_visible())
    phone.screenshot(path=shots / "shell-5-phone-drawer.png")
    phone.keyboard.press("Escape")
    phone.goto(SITE + "/games/")
    phone.wait_for_timeout(500)
    wide = phone.evaluate("document.documentElement.scrollWidth")
    check("phone /games/: no sideways scroll", wide <= 390, f"{wide}px")
    phone.screenshot(path=shots / "shell-6-phone-games.png")
    b.close()
print(f"{sum(res)}/{len(res)} passed")

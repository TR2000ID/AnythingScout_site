"""The one-time copy of Game Scout ratings, end to end, on made-up Edge and Firefox profiles (never your real ones):
seed ratings at 5181 → tools/read_game_ratings.py reads them → the /games/carry link writes them on 5185,
exactly, and never replaces different ratings without asking. Dev server on 5185.

    python tests/browser/carry_check.py <scratch folder>
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
scratch = Path(sys.argv[1])
scratch.mkdir(parents=True, exist_ok=True)
REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
from read_game_ratings import carry_link  # noqa: E402  (the same link the tool prints)

SITE = "http://localhost:5185"
OLD = "http://localhost:5181"
ROWS = [{"game": "steam:620", "rating": "loved", "at": "2026-11-01T10:00:00.000Z"},
        {"game": "steam:400", "rating": "liked", "at": "2026-11-02T10:00:00.000Z", "note": "進撃の巨人 </script> \"q\""},
        {"game": "steam:105600", "rating": "okay", "at": "2026-11-03T10:00:00.000Z"}]
RATINGS = json.dumps({"version": 1, "rows": ROWS}, ensure_ascii=False)
SETTINGS = json.dumps({"store": "jp", "titles": "ja"})
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def saved(page):
    return page.evaluate("[localStorage.getItem('game-scout.ratings'), localStorage.getItem('game-scout.settings')]")


def rate_here(page, title):
    """Rate a game from the sidebar search, staying on the page (what someone might do right after copying)."""
    page.locator("#search-input").fill(title)
    page.wait_for_selector(".search-row")
    page.locator(".search-row").first.click()
    page.wait_for_selector(".dialog")
    page.locator(".dialog .tier-buttons button", has_text="Liked").first.click()
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)


blank = lambda route: route.fulfill(status=200, content_type="text/html", body="<!doctype html>")

with tempfile.TemporaryDirectory(prefix="carry-profile-") as profile_dir, sync_playwright() as p:
    # 1. A made-up Edge profile with Game Scout ratings saved at the old address
    ctx = p.chromium.launch_persistent_context(profile_dir, channel="msedge", headless=True, args=["--profile-directory=Default"])
    pg = ctx.new_page()
    pg.route(OLD + "/**", blank)
    pg.goto(OLD + "/")
    pg.evaluate("([r, s]) => { localStorage.setItem('game-scout.ratings', r); localStorage.setItem('game-scout.settings', s) }", [RATINGS, SETTINGS])
    ctx.close()  # closing writes them to disk

    # 2. The tool reads them from a copy of that profile
    out = scratch / "carry.json"
    run = subprocess.run([sys.executable, str(REPO / "tools" / "read_game_ratings.py"), "--browser", "edge", "--user-data", profile_dir,
                          "--profile", "Default", "--out", str(out)], capture_output=True, text=True, encoding="utf-8")
    print(run.stdout.splitlines()[0] if run.stdout else run.stderr[-300:])
    data = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    check("the tool reads the ratings and settings exactly", data.get("ratings") == RATINGS and data.get("settings") == SETTINGS)
    link = carry_link(SITE, data)

    # 2b. Firefox keeps each site's data in a small SQLite file, longer values Snappy-compressed: same answer
    import sqlite3
    ff = scratch / "firefox-profile"
    db_dir = ff / "storage" / "default" / "http+++localhost+5181" / "ls"
    db_dir.mkdir(parents=True, exist_ok=True)
    (db_dir / "data.sqlite").unlink(missing_ok=True)

    def snappy_literals(raw):
        """Snappy made of literal chunks only (what a decoder must accept); real Firefox data also has copies."""
        out, n = bytearray(), len(raw)
        while True:
            out.append((n & 0x7F) | (0x80 if n > 0x7F else 0)); n >>= 7
            if not n:
                break
        for i in range(0, len(raw), 60):
            chunk = raw[i:i + 60]
            out.append((len(chunk) - 1) << 2); out += chunk
        return bytes(out)

    con = sqlite3.connect(db_dir / "data.sqlite")
    con.execute("create table data (key text primary key, utf16_length integer, conversion_type integer, compression_type integer, last_access_time integer, value blob)")
    con.execute("insert into data values (?, ?, 1, 1, 0, ?)", ("game-scout.ratings", len(RATINGS), snappy_literals(RATINGS.encode("utf-8"))))
    con.execute("insert into data values (?, ?, 1, 0, 0, ?)", ("game-scout.settings", len(SETTINGS), SETTINGS.encode("utf-8")))
    con.commit(); con.close()
    out_ff = scratch / "carry-ff.json"
    subprocess.run([sys.executable, str(REPO / "tools" / "read_game_ratings.py"), "--browser", "firefox",
                    "--firefox-profile", str(ff), "--out", str(out_ff)], capture_output=True, text=True, encoding="utf-8")
    ff_data = json.loads(out_ff.read_text(encoding="utf-8")) if out_ff.exists() else {}
    check("Firefox (compressed): the same ratings and settings, exactly",
          ff_data.get("ratings") == RATINGS and ff_data.get("settings") == SETTINGS)

    # 3. The link writes them on the new site, exactly
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1366, "height": 900}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(SITE + "/games/")
    pg.evaluate("localStorage.clear()")
    pg.goto(link)
    pg.wait_for_selector("h1:has-text('Bring your Game Scout ratings')")
    check("'Copied 3 ratings' shows", "Copied 3 ratings" in pg.locator("main").inner_text())
    check("saved exactly as they were", saved(pg) == [RATINGS, SETTINGS])
    check("the data is gone from the address", "#" not in pg.url, pg.url[:80])
    pg.screenshot(path=scratch / "carry-done.png")
    rate_here(pg, "Half-Life 2")
    after = json.loads(saved(pg)[0])["rows"]
    check("rating another game in the same tab keeps the copied ones", len(after) == 4 and
          all(r in after for r in ROWS), f"{len(after)} saved")
    pg.evaluate("r => localStorage.setItem('game-scout.ratings', r)", RATINGS)
    pg.goto(SITE + "/games/carry?copied=3")  # a fresh load (as after a copy), so the site reads them again
    pg.get_by_role("link", name="Open My games").click()
    pg.wait_for_url("**/games/liked")
    pg.wait_for_selector("article.card", timeout=60000)
    check("My games lists them", pg.locator("article.card").count() >= 1, f"{pg.locator('article.card').count()} on Liked")

    # 4. Different ratings already there: ask, don't overwrite
    other = json.dumps({"version": 1, "rows": [{"game": "steam:730", "rating": "liked", "at": "x"}]})
    pg.evaluate("r => localStorage.setItem('game-scout.ratings', r)", other)
    pg.goto(link)
    pg.wait_for_selector("button:has-text('Replace')")
    check("different ratings: asks first, overwrites nothing", saved(pg)[0] == other and "1 different" in pg.locator("main").inner_text())
    pg.screenshot(path=scratch / "carry-ask.png")
    pg.get_by_role("button", name="Replace").click()
    pg.wait_for_selector("text=Copied 3 ratings")
    check("Replace writes them exactly", saved(pg) == [RATINGS, SETTINGS])
    rate_here(pg, "Half-Life 2")
    after = json.loads(saved(pg)[0])["rows"]
    check("...and rating after Replace keeps them too", len(after) == 4 and all(r in after for r in ROWS), f"{len(after)} saved")
    pg.evaluate("r => localStorage.setItem('game-scout.ratings', r)", RATINGS)
    pg.goto(link)
    check("opening the link again: already here", "already here" in pg.locator("main").inner_text())
    pg.goto(SITE + "/games/carry")
    check("no data in the link: says so", "no ratings in it" in pg.locator("main").inner_text())
    check("no page errors", not errors, errors[:2])
    b.close()
print(f"{sum(res)}/{len(res)} passed")

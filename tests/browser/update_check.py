"""Games' "Update now" on the combined site: the button runs game-scout's update_steam.py (~10 minutes, Steam's
free store API) and the new files land in THIS repo, not in game-scout's old web/. Dev server on 5185 only.

    python tests/browser/update_check.py <folder for screenshots>
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
SITE = "http://localhost:5185"
HERE = Path(__file__).resolve().parents[2]
NEW = HERE / "web" / "public" / "data" / "games" / "steam" / "latest.json"
OLD = HERE.parent / "game-scout" / "web" / "public" / "data" / "steam" / "latest.json"
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def stamp(path):
    return path.read_text(encoding="utf-8") if path.exists() else None


before_new, before_old = stamp(NEW), stamp(OLD)
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1366, "height": 900}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(SITE + "/games/settings")
    pg.get_by_role("button", name="Update now").first.click()
    started = time.time()
    run = {}
    while time.time() - started < 20 * 60:
        run = pg.request.get(SITE + "/__update/steam").json()
        if run.get("finished"):
            break
        pg.wait_for_timeout(5000)
    print(f"finished after {(time.time() - started) / 60:.1f} min, ok={run.get('ok')}; last lines: {run.get('lines', [])[-3:]}")
    pg.screenshot(path=shots / "update-done.png")
    check("the update finished without errors", run.get("ok") is True)
    after_new = stamp(NEW)
    check("this repo's latest.json changed", after_new is not None and after_new != before_new,
          json.loads(after_new)["updated"] if after_new else "missing")
    check("game-scout's old web/ data didn't change", stamp(OLD) == before_old)
    pg.goto(SITE + "/games/sales")
    pg.wait_for_selector("article.card", timeout=60000)
    check("cards still show, with prices", pg.locator(".price-now").count() > 0)
    check("no page errors", not errors, errors[:2])
    b.close()
print(f"{sum(res)}/{len(res)} passed")

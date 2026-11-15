"""Anime Scout: the new-episodes calendar file (AniList answered by a fake). Needs `npm run dev` in web/.

    python tests/browser/calendar_check.py <folder for the downloaded file>
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:5185/"
res = []
NEXT = int(time.time()) + 3 * 24 * 3600


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def anilist(route):
    def media(mal, status, title, ep=None, total=None, relations=()):
        return {"idMal": mal, "status": status, "episodes": total, "title": {"romaji": title, "english": title, "native": title},
                "nextAiringEpisode": {"airingAt": NEXT, "episode": ep} if ep else None,
                "relations": {"edges": [{"relationType": "SEQUEL", "node": r} for r in relations]}}
    sequel = media(99001, "RELEASING", "Frieren Season 2", ep=5, total=10)
    route.fulfill(status=200, json={"data": {"Page": {"media": [
        media(21, "RELEASING", "One Piece", ep=1150),                           # airing, no episode count: 12 weeks
        media(52991, "FINISHED", "Frieren", relations=[sequel]),                # finished, but its sequel is airing
        media(5114, "FINISHED", "Fullmetal Alchemist: Brotherhood"),           # not on air
    ]}}})


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    ctx = b.new_context(viewport={"width": 1300, "height": 900}, locale="en-US", accept_downloads=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.route("https://graphql.anilist.co/**", anilist)
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    rows = [{"show": k, "rating": "liked", "at": "x"} for k in ["mal:21", "mal:52991", "mal:5114"]]
    pg.evaluate(f"localStorage.clear(); localStorage.setItem('anime-scout.ratings', JSON.stringify({{version: 1, rows: {json.dumps(rows)}}}))")
    pg.goto(URL + "?cal#/liked")
    pg.wait_for_selector("article.card", timeout=60000)
    with pg.expect_download() as info:
        pg.get_by_role("button", name="New episodes calendar").click()
    path = out / info.value.suggested_filename
    info.value.save_as(path)
    ics = path.read_text(encoding="utf-8")
    check("a .ics file", path.suffix == ".ics" and ics.startswith("BEGIN:VCALENDAR"), path.name)
    check("two shows on air (the sequel counts, the finished show doesn't)", ics.count("BEGIN:VEVENT") == 2 and "Frieren Season 2" in ics and "Brotherhood" not in ics)
    check("Frieren S2: episodes 5-10 = 6 weeks", "RRULE:FREQ=WEEKLY;COUNT=6" in ics)
    check("One Piece, no episode count: 12 weeks", "RRULE:FREQ=WEEKLY;COUNT=12" in ics)
    check("line ends the format wants (\\r\\n)", "\r\n" in path.read_bytes().decode("utf-8"))
    check("a message says how many", "2 shows on air" in pg.locator(".toast, [role=status]").first.inner_text())
    check("no page errors", not errors, errors[:2])
    b.close()
print(f"{sum(res)}/{len(res)} passed")

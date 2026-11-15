"""Anime Scout: import your list (AniList answered by a fake, MyAnimeList from a made-up export file)."""
import os
import gzip
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
here = Path(sys.argv[1])
here.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("SITE", "http://localhost:5185").rstrip("/") + "/anime/"  # SITE=https://... checks the live site
res = []


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


ANILIST_LIST = {"data": {"MediaListCollection": {"lists": [{"entries": [
    {"status": "COMPLETED", "score": 10, "media": {"idMal": 5114}},    # FMA: Brotherhood, way above average -> loved
    {"status": "COMPLETED", "score": 8, "media": {"idMal": 1535}},     # Death Note -> liked
    {"status": "COMPLETED", "score": 6, "media": {"idMal": 16498}},    # Attack on Titan -> okay...
    {"status": "COMPLETED", "score": 9.5, "media": {"idMal": 25777}},  # ...but its Season 2 is loved: the card gets loved
    {"status": "COMPLETED", "score": 0, "media": {"idMal": 21}},       # One Piece, unscored -> liked
    {"status": "DROPPED", "score": 0, "media": {"idMal": 11061}},      # Hunter x Hunter dropped -> disliked
    {"status": "PLANNING", "score": 0, "media": {"idMal": 9253}},      # Steins;Gate, not watched -> left out
    {"status": "COMPLETED", "score": 7, "media": {"idMal": 999999999}},  # not on Anime Scout
]}]}}}

MAL_XML = """<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <anime><series_animedb_id>9253</series_animedb_id><my_score>10</my_score><my_status>Completed</my_status></anime>
  <anime><series_animedb_id>30276</series_animedb_id><my_score>5</my_score><my_status>Dropped</my_status></anime>
  <anime><series_animedb_id>38000</series_animedb_id><my_score>0</my_score><my_status>Plan to Watch</my_status></anime>
</myanimelist>"""
(here / "animelist.xml").write_text(MAL_XML, encoding="utf-8")
(here / "animelist.xml.gz").write_bytes(gzip.compress(MAL_XML.encode("utf-8")))
(here / "not-a-list.xml").write_text("<html>hello</html>", encoding="utf-8")


def answer(route):
    name = json.loads(route.request.post_data)["variables"]["name"]
    if name == "nobody":
        route.fulfill(status=404, json={"errors": [{"message": "Not Found.", "status": 404}], "data": None})
    else:
        route.fulfill(status=200, json=ANILIST_LIST)


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1300, "height": 900}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.route("https://graphql.anilist.co/**", answer)
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    pg.evaluate("localStorage.clear()")
    pg.evaluate("localStorage.setItem('anime-scout.ratings', JSON.stringify({version:1, rows:[{show:'mal:1535', rating:'disliked', at:'x'}]}))")
    pg.goto(URL + "?fresh")
    pg.wait_for_selector("article.card", timeout=60000)

    pg.get_by_role("button", name="Import your list").first.click()
    pg.get_by_label("AniList username").fill("nobody")
    pg.get_by_role("button", name="Get my list").click()
    pg.wait_for_selector(".notice-error")
    check("unknown AniList user: a clear message", "No AniList user" in pg.locator(".notice-error").inner_text())

    pg.get_by_label("AniList username").fill("someone")
    pg.get_by_role("button", name="Get my list").click()
    pg.wait_for_selector(".import-found")
    found = pg.locator(".import-found").inner_text()
    check("AniList: 4 new, 1 already rated kept, 1 not on the site", "4 new ratings" in found and "1 you already rated" in found and "1 not on Anime Scout" in found, found.replace("\n", " | "))
    # average of the scores = 8.1: AoT's own 6 would be Disliked, its Season 2's 9.5 is Liked: the card gets Liked
    check("breakdown: the better season wins (AoT liked, not disliked)", "Loved 1" in found and "Liked 2" in found and "Disliked 1" in found)
    pg.screenshot(path=here / "import-anilist.png")
    pg.get_by_role("button", name="Add 4 ratings").click()
    pg.wait_for_timeout(500)
    rows = {r["show"]: r["rating"] for r in json.loads(pg.evaluate("localStorage.getItem('anime-scout.ratings')"))["rows"]}
    check("saved: AoT liked through its season, One Piece liked, HxH disliked",
          rows.get("mal:16498") == "liked" and rows.get("mal:21") == "liked" and rows.get("mal:11061") == "disliked", rows)
    check("your own rating was kept (Death Note stays disliked)", rows.get("mal:1535") == "disliked")
    check("planned show left out", "mal:9253" not in rows)
    check("picks appear", "Recommended" in pg.locator("h1").first.inner_text())

    for name in ["animelist.xml", "animelist.xml.gz"]:
        pg.goto(URL + "liked")
        pg.get_by_role("button", name="Import your list").first.click()
        pg.wait_for_selector("input[type=file]:not([disabled])", state="attached", timeout=60000)
        pg.locator("input[type=file]").set_input_files(str(here / name))
        pg.wait_for_selector(".import-found")
        found = pg.locator(".import-found").inner_text()
        check(f"MyAnimeList {name}: Steins;Gate + the dropped show", "2 new ratings" in found, found.replace("\n", " | "))
        pg.keyboard.press("Escape")

    # Slow connection: the anime data arrives 3 s late. The import waits for it instead of doing nothing
    pg.route("**/data/anime/cards.json", lambda route: (pg.wait_for_timeout(3000), route.continue_()))
    pg.goto(URL + "liked?slow")
    pg.get_by_role("button", name="Import your list").first.click()
    check("slow data: file + AniList buttons wait, with a loading message",
          pg.locator("input[type=file]").is_disabled() and pg.get_by_role("button", name="Get my list").is_disabled()
          and pg.locator(".dialog .notice").first.is_visible())
    pg.wait_for_selector("input[type=file]:not([disabled])", state="attached", timeout=60000)
    pg.locator("input[type=file]").set_input_files(str(here / "animelist.xml"))
    pg.wait_for_selector(".import-found")
    check("slow data: the file works once the data is in", "2 new ratings" in pg.locator(".import-found").inner_text())
    pg.keyboard.press("Escape")
    pg.unroute("**/data/anime/cards.json")

    pg.get_by_role("button", name="Import your list").first.click()
    pg.locator("input[type=file]").set_input_files(str(here / "not-a-list.xml"))
    pg.wait_for_selector(".notice-error")
    check("a wrong file: a clear message", "MyAnimeList export" in pg.locator(".notice-error").inner_text())
    check("no page errors", not errors, errors[:2])
    b.close()
print(f"{sum(res)}/{len(res)} passed")

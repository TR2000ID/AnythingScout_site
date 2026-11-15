"""Anime Scout: Watch together (AniList answered by a fake friend). Needs `npm run dev` in web/.

    python tests/browser/together_check.py <folder for screenshots>
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:5185/"
res = []

MINE = ["mal:5114", "mal:16498", "mal:11061"]  # FMA: Brotherhood, Attack on Titan, Hunter x Hunter
FRIEND = [4224, 2167, 6045]                      # Toradora!, Clannad, Kimi ni Todoke


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def friend_list(route):
    entries = [{"status": "COMPLETED", "score": 9, "media": {"idMal": m}} for m in FRIEND]
    route.fulfill(status=200, json={"data": {"MediaListCollection": {"lists": [{"entries": entries}]}}})


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page(viewport={"width": 1300, "height": 950}, locale="en-US")
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.route("https://graphql.anilist.co/**", friend_list)
    pg.goto(URL)
    pg.wait_for_selector("article.card", timeout=60000)
    rows = [{"show": k, "rating": "liked", "at": "x"} for k in MINE]
    pg.evaluate(f"localStorage.clear(); localStorage.setItem('anime-scout.ratings', JSON.stringify({{version: 1, rows: {json.dumps(rows)}}}))")
    pg.goto(URL + "?mine#/together")  # a real load, so the site reads the ratings just stored
    pg.wait_for_selector(".people")
    check("one person: asks for a friend", "Add at least one friend" in pg.locator("main").inner_text())

    pg.get_by_label("Friend's AniList username").fill("aki")
    pg.get_by_role("button", name="Add friend").click()
    pg.wait_for_selector("article.card", timeout=30000)
    pg.wait_for_timeout(800)
    check("friend added with their ratings", "aki" in pg.locator(".people").inner_text() and "3 rated" in pg.locator(".people").inner_text())
    note = pg.locator(".card-reason").first.inner_text()
    check("each card says how it suits each person", "You" in note and "aki" in note and "%" in note, note)
    titles = pg.locator("article.card .card-title").all_inner_texts()
    rated_titles = {"Fullmetal Alchemist: Brotherhood", "Attack on Titan", "Hunter x Hunter (2011)", "Toradora!", "Clannad", "Kimi ni Todoke: From Me to You"}
    check("nothing anyone has rated", not (set(titles) & rated_titles), sorted(set(titles) & rated_titles))
    # Shonen fan + romance fan barely overlap, so only shows that work for both remain (6 on 2026-11-06:
    # Code Geass, Steins;Gate, A Silent Voice, Gurren Lagann ...): fewer is the honest answer here
    check("group picks that bridge both tastes", len(titles) >= 5, f"{len(titles)}: {titles[:4]}")
    pg.screenshot(path=shots / "together.png")

    pg.reload()
    pg.wait_for_selector("article.card", timeout=30000)
    check("friends are remembered after a reload", "aki" in pg.locator(".people").inner_text())
    pg.get_by_role("button", name="Remove aki").click()
    check("removing the friend", "Add at least one friend" in pg.locator("main").inner_text())
    check("no page errors", not errors, errors[:2])
    b.close()
print(f"{sum(res)}/{len(res)} passed")

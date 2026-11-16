"""Accounts, end to end: three separate browsers ("PC", "phone", "friend's computer", each with its own storage)
against the PC site + the local test database. Creates a new account each run (Chk + the time), so reruns don't
collide. Both dev servers must be running (worker: npm run db:local once, then npm run dev).

    python tests/browser/account_check.py <folder for screenshots>
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
shots = Path(sys.argv[1])
shots.mkdir(parents=True, exist_ok=True)
SITE = os.environ.get("SITE", "http://localhost:5185").rstrip("/")  # SITE=https://... checks the live site
PREFIX = os.environ.get("ACCOUNT_PREFIX", "Chk")  # the live check uses zzcheck- (removed afterwards)
NAME = f"{PREFIX}{time.strftime('%m%d%H%M%S')}"  # a capital first letter: the lowercase name must NOT open it
LIVE = not SITE.startswith("http://localhost")
res = []

if not LIVE:
    # Every run creates an account from 127.0.0.1, and the server allows 10 creates per hour per address (the
    # guessing limit). On the PC's own test database, start each run with that counter at zero.
    worker = Path(__file__).resolve().parents[2] / "worker"
    subprocess.run('npx wrangler d1 execute anything-scout --local --command "DELETE FROM misses"', cwd=worker, shell=True, capture_output=True)


def check(name, ok, detail=""):
    res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def saved_games(page):
    text = page.evaluate("localStorage.getItem('game-scout.ratings')")
    return {row["game"]: row["rating"] for row in json.loads(text)["rows"]} if text else {}


def seed_games(page, keys):
    rows = [{"game": k, "rating": "liked", "at": "2026-10-01T00:00:00.000Z"} for k in keys]
    page.evaluate(f"localStorage.setItem('game-scout.ratings', JSON.stringify({{version: 1, rows: {json.dumps(rows)}}}))")


def account_held(page):
    """What the account holds on the server (asked with this browser's own sign-in; sends nothing)"""
    return page.evaluate("""async () => {
      const r = JSON.parse(localStorage.getItem('anything-scout.account') || 'null');
      if (!r || !r.token) return null;
      const res = await fetch('/api/account/sync', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
        body: JSON.stringify({ rev: 0, items: [], blocks: [] }) });
      return await res.json();
    }""")


def held_games(page):
    held = account_held(page) or {"items": []}
    return {i["item"]: i["rating"] for i in held["items"] if i["section"] == "games"}


def wait_until(page, test, seconds=25):
    end = time.time() + seconds
    while time.time() < end:
        try:
            if test():
                return True
        except Exception:
            pass
        page.wait_for_timeout(300)
    return False


def open_games(page, path="/games/"):
    page.goto(SITE + path)
    page.wait_for_selector("article.card", timeout=60000)


def sign_in(page, name, mode="signin"):
    page.locator(".account-signin, .account-trigger").first.click()
    if page.locator(".account-signin").count() == 0:  # the "Signed out" menu: its Sign in item
        page.get_by_role("menuitem", name="Sign in").click()
    page.wait_for_selector("#account-name")
    page.locator(".account-modes button").nth(1 if mode == "create" else 0).click()
    page.locator("#account-name").fill(name)
    page.locator(".account-form .button-primary").click()
    page.wait_for_selector(".account-trigger .avatar, .account-ask, .account-form .notice-error", timeout=20000)


def rate_by_search(page, query, tier="Liked"):
    page.locator("#search-input").fill(query)
    page.wait_for_selector(".search-row")
    page.locator(".search-row").first.click()
    page.wait_for_selector(".dialog .tier-buttons")
    page.locator(".dialog .tier-buttons button", has_text=tier).first.click()
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)


def menu_item(page, name):
    page.locator(".account-trigger").click()
    page.get_by_role("menuitem", name=name).click()


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pc_ctx = b.new_context(viewport={"width": 1366, "height": 900}, locale="en-US")
    phone_ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="en-US", is_mobile=True, has_touch=True)
    friend_ctx = b.new_context(viewport={"width": 1280, "height": 860}, locale="en-US")
    pc, phone, friend = pc_ctx.new_page(), phone_ctx.new_page(), friend_ctx.new_page()
    errors = []
    for pg in (pc, phone, friend):
        pg.on("pageerror", lambda e: errors.append(str(e)))
    SEEDS = ["steam:400", "steam:220", "steam:70"]  # Portal, Half-Life 2, Half-Life

    # 1. PC already has 3 Games ratings → Create account → they go into it
    open_games(pc)
    seed_games(pc, SEEDS)
    open_games(pc)
    sign_in(pc, NAME, "create")
    created = pc.locator(".account-name").count() > 0
    check("1. PC: create account → the bar shows the name", created and pc.locator(".account-name").inner_text() == NAME,
          pc.locator(".account-name").inner_text() if created else pc.locator(".dialog").inner_text())
    if not created:
        sys.exit(1)
    check("1. ...and the 3 ratings are in the account", wait_until(pc, lambda: set(held_games(pc)) == set(SEEDS)), held_games(pc))
    me = pc.evaluate("""async () => { const r = JSON.parse(localStorage.getItem('anything-scout.account'));
      return (await fetch('/api/account/me', { headers: { Authorization: 'Bearer ' + r.token } })).json(); }""")
    check("1. me.empty is false", me.get("empty") is False, me)
    pc.screenshot(path=shots / "account-1-pc-signed-in.png")

    # 2. Phone (nothing saved) signs in → the same 3 ratings, on My games
    open_games(phone)
    sign_in(phone, NAME)
    check("2. phone: sign in → the same 3 ratings", wait_until(phone, lambda: set(saved_games(phone)) == set(SEEDS)), saved_games(phone))
    phone.goto(SITE + "/games/liked")
    phone.wait_for_selector("article.card", timeout=60000)
    text = phone.locator("main").inner_text()
    check("2. ...listed on My games", "Portal" in text and "Half-Life" in text)

    # 3. Both offline: phone rates X, PC rates Y. Back online → both have X and Y (each rating merged on its own)
    open_games(phone)
    pc_ctx.set_offline(True)
    phone_ctx.set_offline(True)
    rate_by_search(phone, "Portal 2")
    rate_by_search(pc, "Terraria")
    X, Y = "steam:620", "steam:105600"
    check("3. offline ratings saved in each browser", X in saved_games(phone) and Y in saved_games(pc), f"{list(saved_games(phone))} / {list(saved_games(pc))}")
    phone_ctx.set_offline(False)
    pc_ctx.set_offline(False)
    open_games(phone)  # reload: syncs X up
    check("3. X reaches the account", wait_until(phone, lambda: X in held_games(phone)), held_games(phone))
    open_games(pc)  # reload: sends Y, gets X
    check("3. PC has X and Y", wait_until(pc, lambda: X in saved_games(pc) and Y in saved_games(pc)), saved_games(pc))
    open_games(phone)
    check("3. phone has X and Y", wait_until(phone, lambda: X in saved_games(phone) and Y in saved_games(phone)), saved_games(phone))

    # 4. Phone removes X → the PC loses X after a reload
    phone.goto(SITE + "/games/liked")
    phone.wait_for_selector("article.card", timeout=60000)
    card = phone.locator("article.card", has_text="Portal 2").first
    card.locator(".rate-trigger").click()
    phone.get_by_role("menuitem", name="Remove rating").click()
    check("4. phone: X removed here", wait_until(phone, lambda: X not in saved_games(phone), 5), saved_games(phone))
    check("4. ...and in the account (as a removal)", wait_until(phone, lambda: (held_games(phone).get(X, "?") is None)), held_games(phone).get(X, "missing"))
    open_games(pc)
    check("4. PC loses X after a reload", wait_until(pc, lambda: X not in saved_games(pc)), saved_games(pc))

    # 5. An Anime setting changed on the PC arrives on the phone
    pc.goto(SITE + "/anime/settings")
    pc.get_by_role("radiogroup", name="Titles").get_by_role("radio", name="日本語").click()
    held_block = lambda page: {b["name"]: b["value"] for b in (account_held(page) or {"blocks": []})["blocks"]}
    check("5. PC: Titles 日本語 reaches the account", wait_until(pc, lambda: json.loads(held_block(pc).get("anime.settings", "{}")).get("titles") == "ja"), held_block(pc))
    phone.goto(SITE + "/anime/")
    anime_settings = lambda page: json.loads(page.evaluate("localStorage.getItem('anime-scout.settings')") or "{}")
    check("5. ...and on the phone", wait_until(phone, lambda: anime_settings(phone).get("titles") == "ja"), anime_settings(phone))

    # 6 + 7. A friend's computer with 2 ratings of its own
    open_games(friend)
    seed_games(friend, ["steam:730", "steam:570"])
    open_games(friend)
    sign_in(friend, NAME.swapcase())  # Chk… → cHK…, zzcheck-… → ZZCHECK-…: the same letters, other capitals
    err = friend.locator(".account-form .notice-error").inner_text() if friend.locator(".account-form .notice-error").count() else ""
    check("6. capitals count: the name in other capitals → No account with that name.", err == "No account with that name.", err)
    friend.locator("#account-name").fill(NAME)
    friend.locator(".account-form .button-primary").click()
    friend.wait_for_selector(".account-ask", timeout=20000)
    ask = friend.locator(".account-ask").inner_text()
    check("7. friend's computer: asks about its 2 ratings", "2 ratings" in ask, ask)
    friend.screenshot(path=shots / "account-2-friend-ask.png")
    friend.get_by_role("button", name="Leave them out").click()
    friend.wait_for_selector(".account-trigger .avatar", timeout=20000)
    held_now = held_games(friend)
    account_list = {k for k, v in held_now.items() if v}
    check("7. Leave them out → the account's lists here, not the friend's", wait_until(friend, lambda: set(saved_games(friend)) == account_list), f"{saved_games(friend)} vs {account_list}")
    check("7. ...and nothing of the friend's went into the account", "steam:730" not in held_now and "steam:570" not in held_now, held_now)
    menu_item(friend, "Sign out")
    friend.wait_for_selector(".account-signin", timeout=20000)
    check("7. sign out → the friend's 2 are back, none of the account's", set(saved_games(friend)) == {"steam:730", "steam:570"}, saved_games(friend))
    check("10. signed out, the site still works", friend.locator("article.card").count() > 5 and friend.locator(".account-signin").is_visible())

    # 8. Two tabs of the PC browser, each rates a different game
    tab_a = pc
    tab_b = pc_ctx.new_page()
    tab_b.on("pageerror", lambda e: errors.append(str(e)))
    open_games(tab_a)
    open_games(tab_b)
    before = set(saved_games(tab_a))
    for tab, index in ((tab_a, 0), (tab_b, 4)):
        tab.locator("main article.card").nth(index).locator(".rate-trigger").click()
        tab.get_by_role("menuitem", name="Liked").click()
        tab.wait_for_timeout(200)
    new = set(saved_games(tab_a)) - before
    check("8. two tabs: two new ratings in the browser", len(new) == 2, new)
    check("8. ...both reach the account", wait_until(tab_a, lambda: new <= {k for k, v in held_games(tab_a).items() if v}), held_games(tab_a))
    open_games(phone)
    check("8. ...and a phone reload has both", wait_until(phone, lambda: new <= set(saved_games(phone))), saved_games(phone))
    tab_b.close()

    # 9. Picture: a 600x400 image → a 128x128 square in the bar; Remove picture → the letter again
    png = shots / "account-picture-600x400.png"
    data_url = pc.evaluate("""() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400;
      const g = c.getContext('2d'); g.fillStyle = '#3a6ea5'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#eca44a';
      g.fillRect(250, 150, 100, 100); return c.toDataURL('image/png'); }""")
    import base64
    png.write_bytes(base64.b64decode(data_url.split(",")[1]))
    pc.locator(".account-spot input[type=file]").set_input_files(str(png))
    ok = wait_until(pc, lambda: pc.evaluate("(() => { const i = document.querySelector('img.avatar'); return !!i && i.complete && i.naturalWidth === 128; })()"))
    check("9. picture: the bar shows it, 128 px wide", ok)
    pc.locator(".account-trigger").click()
    pc.screenshot(path=shots / "account-3-picture-menu.png")
    pc.get_by_role("menuitem", name="Remove picture").click()
    check("9. Remove picture → the letter circle", wait_until(pc, lambda: pc.locator(".avatar-letter").count() == 1))

    # 11. Phone, 390 px: the account spot doesn't push the tabs off screen
    open_games(phone)
    sideways = phone.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    tabs_box = phone.locator(".service-tabs").bounding_box()
    avatar_box = phone.locator(".account-trigger").bounding_box()
    check("11. phone: no sideways scroll, tabs and picture both on screen",
          not sideways and tabs_box["width"] > 150 and avatar_box["x"] + avatar_box["width"] <= 390, f"tabs {tabs_box['width']:.0f}px, picture right edge {avatar_box['x'] + avatar_box['width']:.0f}")
    check("11. phone: the picture only (no name)", not phone.locator(".account-name").is_visible())
    phone.screenshot(path=shots / "account-4-phone.png")

    check("no page errors", not errors, errors[:3])
    print(f"account: {NAME}")
    b.close()

print(f"{sum(res)}/{len(res)} passed")
sys.exit(0 if all(res) else 1)

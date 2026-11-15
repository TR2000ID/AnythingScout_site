"""One-time copy of your Game Scout ratings into the combined site.

Game Scout ran at http://localhost:5181, and a browser keeps each address's saved data apart, so the combined
site can't see those ratings. This reads them from a COPY of your browser's saved data (Firefox or Edge; the
real data is only read, never changed, and the browser can stay open) and makes a link that writes them into
the site:

    python tools/read_game_ratings.py              finds them (Firefox first, then Edge), saves
                                                   web/.carry/games.json, prints the links
    python tools/read_game_ratings.py --open dev   ...and opens the PC site's link in that same browser
                                                   (--open live: the live site's link)

The ratings ride in the link after #, which the browser never sends to a server. The page /games/carry checks
they arrived exactly, and asks before replacing different ratings already there.

Check it worked (browsers save to disk a few seconds after a change, so wait a little first):
    python tools/read_game_ratings.py --origin http://localhost:5185 --compare web/.carry/games.json
    python tools/read_game_ratings.py --origin https://anime-scout.nomikai-scout-worker.workers.dev --compare web/.carry/games.json

Needs the global python (Edge is read through Playwright, the same one as tests/browser; Firefox needs nothing).
"""
import argparse
import base64
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parents[1]
EDGE_DATA = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Edge" / "User Data"
FIREFOX_PROFILES = Path(os.environ.get("APPDATA", "")) / "Mozilla" / "Firefox" / "Profiles"
DEV, LIVE = "http://localhost:5185", "https://anime-scout.nomikai-scout-worker.workers.dev"
KEYS = {"ratings": "game-scout.ratings", "settings": "game-scout.settings"}
MAX_LINK = 30000  # Windows passes at most ~32,000 characters to a program


def encode(data):
    """{"ratings": text, "settings": text|None} → link-safe text. Same as encodeCarry in web/src/games/lib/carry.ts."""
    raw = json.dumps({"ratings": data["ratings"], "settings": data["settings"]}, ensure_ascii=False, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode("utf-8")).rstrip(b"=").decode("ascii")


def carry_link(site, data):
    return f"{site.rstrip('/')}/games/carry#{encode(data)}"


def count(ratings):
    try:
        return len(json.loads(ratings).get("rows", []))
    except (TypeError, ValueError, AttributeError):
        return 0


# ---------- Firefox: each site's saved data is a small SQLite file ----------
def snappy_raw(buf):
    """Undo raw Snappy compression (Firefox compresses longer saved values with it: compression_type 1)."""
    pos, size, shift = 0, 0, 0
    while True:  # the uncompressed size, 7 bits per byte
        b = buf[pos]
        pos += 1
        size |= (b & 0x7F) << shift
        shift += 7
        if b < 0x80:
            break
    out = bytearray()
    while pos < len(buf):
        tag = buf[pos]
        pos += 1
        kind = tag & 3
        if kind == 0:  # literal bytes
            length = tag >> 2
            if length >= 60:
                extra = length - 59
                length = int.from_bytes(buf[pos:pos + extra], "little")
                pos += extra
            length += 1
            out += buf[pos:pos + length]
            pos += length
            continue
        if kind == 1:  # copy from earlier output, short offset
            length, offset = ((tag >> 2) & 7) + 4, ((tag >> 5) << 8) | buf[pos]
            pos += 1
        elif kind == 2:
            length, offset = (tag >> 2) + 1, int.from_bytes(buf[pos:pos + 2], "little")
            pos += 2
        else:
            length, offset = (tag >> 2) + 1, int.from_bytes(buf[pos:pos + 4], "little")
            pos += 4
        for _ in range(length):  # one byte at a time: a copy may overlap what it's writing
            out.append(out[-offset])
    if len(out) != size:
        raise ValueError("damaged Snappy data")
    return bytes(out)


def firefox_file(profile, origin):
    """http://localhost:5181 → <profile>/storage/default/http+++localhost+5181/ls/data.sqlite"""
    u = urlsplit(origin)
    name = f"{u.scheme}+++{u.hostname}" + (f"+{u.port}" if u.port else "")
    return profile / "storage" / "default" / name / "ls" / "data.sqlite"


def read_firefox(profile, origin):
    """The two saved texts for one address in a Firefox profile, read from a copy of its file (None: no file)."""
    db = firefox_file(profile, origin)
    if not db.exists():
        return None
    with tempfile.TemporaryDirectory(prefix="carry-") as tmp:
        copy = Path(tmp) / "data.sqlite"
        shutil.copy2(db, copy)
        for extra in ("-wal", "-shm"):  # changes not yet folded into the main file
            if Path(f"{db}{extra}").exists():
                shutil.copy2(f"{db}{extra}", f"{copy}{extra}")
        con = sqlite3.connect(copy)
        try:
            rows = {key: (conv, comp, value) for key, conv, comp, value in
                    con.execute("select key, conversion_type, compression_type, value from data")}
        finally:
            con.close()
    found = {}
    for name, key in KEYS.items():
        if key not in rows:
            found[name] = None
            continue
        conv, comp, value = rows[key]
        raw = snappy_raw(bytes(value)) if comp == 1 else bytes(value)
        found[name] = raw.decode("utf-8" if conv == 1 else "utf-16-le")
    return found


def firefox_profiles():
    return sorted(p for p in FIREFOX_PROFILES.glob("*") if p.is_dir()) if FIREFOX_PROFILES.exists() else []


def find_firefox():
    for base in [os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")]:
        if base and (Path(base) / "Mozilla Firefox" / "firefox.exe").exists():
            return str(Path(base) / "Mozilla Firefox" / "firefox.exe")
    return shutil.which("firefox")


# ---------- Edge: read through Edge itself (Playwright), on a copy of its data ----------
def last_profile(user_data):
    """The Edge profile you used last (Local State → profile.last_used), else "Default"."""
    try:
        state = json.loads((user_data / "Local State").read_text(encoding="utf-8"))
        return state.get("profile", {}).get("last_used") or "Default"
    except (OSError, ValueError):
        return "Default"


def copy_storage(user_data, profile, into):
    """Copy only what's needed (Local State + the profile's Local Storage), skipping the LOCK file Edge holds."""
    source = user_data / profile / "Local Storage" / "leveldb"
    target = into / profile / "Local Storage" / "leveldb"
    target.mkdir(parents=True)
    if (user_data / "Local State").exists():
        shutil.copy2(user_data / "Local State", into / "Local State")
    for f in source.iterdir():
        if f.is_file() and f.name != "LOCK":
            try:
                shutil.copy2(f, target / f.name)
            except PermissionError:
                raise SystemExit(f"Edge is holding {f.name}: close Edge and run this again.")


def read_edge(user_data, profile, origin):
    """The two saved texts for one address, read from a copy of the Edge data."""
    from playwright.sync_api import sync_playwright
    with tempfile.TemporaryDirectory(prefix="carry-") as tmp:
        copy_storage(user_data, profile, Path(tmp))
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(tmp, channel="msedge", headless=True,
                                                       args=[f"--profile-directory={profile}"])
            page = ctx.new_page()
            # A blank page at that address is enough to read its saved data (the site itself needn't run)
            page.route(origin.rstrip("/") + "/**",
                       lambda route: route.fulfill(status=200, content_type="text/html", body="<!doctype html>"))
            page.goto(origin.rstrip("/") + "/")
            found = {name: page.evaluate("k => localStorage.getItem(k)", key) for name, key in KEYS.items()}
            ctx.close()
    return found


def find_edge():
    for base in [os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles")]:
        if base and (Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe").exists():
            return str(Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe")
    return shutil.which("msedge")


# ---------- which browser has them ----------
def find_saved(args):
    """(where, browser, found) for --origin: the first place with Game Scout ratings, Firefox before Edge.
    With --compare, the first place that has any saved data for that address."""
    tried = []
    if args.browser in (None, "firefox"):
        for profile in ([args.firefox_profile] if args.firefox_profile else firefox_profiles()):
            tried.append(f"Firefox {profile.name}")
            found = read_firefox(profile, args.origin)
            if found and (found["ratings"] or args.compare):
                return f"Firefox profile {profile.name}", "firefox", found
    if args.browser in (None, "edge"):
        profile = args.profile or last_profile(args.user_data)
        if (args.user_data / profile / "Local Storage" / "leveldb").is_dir():
            tried.append(f"Edge {profile}")
            found = read_edge(args.user_data, profile, args.origin)
            if found["ratings"] or args.compare:
                return f"Edge profile {profile}", "edge", found
    raise SystemExit(f"No Game Scout ratings saved for {args.origin} (looked in: {', '.join(tried) or 'no browser data found'}).")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--browser", choices=["firefox", "edge"], help="only look in this browser")
    ap.add_argument("--firefox-profile", type=Path, help="one Firefox profile folder (default: all of them)")
    ap.add_argument("--user-data", type=Path, default=EDGE_DATA, help="Edge's User Data folder")
    ap.add_argument("--profile", help="Edge profile folder name (default: the one you used last)")
    ap.add_argument("--origin", default="http://localhost:5181", help="the address whose saved ratings to read")
    ap.add_argument("--out", type=Path, default=REPO / "web" / ".carry" / "games.json")
    ap.add_argument("--compare", type=Path, help="don't save: say whether --origin holds exactly this file's ratings")
    ap.add_argument("--open", choices=["dev", "live"], action="append", default=[], help="open that site's carry link")
    args = ap.parse_args()

    where, browser, found = find_saved(args)
    if args.compare:
        want = json.loads(args.compare.read_text(encoding="utf-8"))
        same = found["ratings"] == want["ratings"] and (want["settings"] is None or found["settings"] == want["settings"])
        print(f"{args.origin} in {where}: {count(found['ratings'])} ratings — {'IDENTICAL' if same else 'DIFFERENT'} to {args.compare.name}")
        sys.exit(0 if same else 1)

    data = {"ratings": found["ratings"], "settings": found["settings"], "browser": browser,
            "from": f"{where} @ {args.origin}", "read": datetime.now().isoformat(timespec="seconds")}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{count(found['ratings'])} ratings from {where} (settings: {'yes' if found['settings'] else 'none saved'}) → {args.out}")

    links = {"dev": carry_link(DEV, data), "live": carry_link(LIVE, data)}
    if len(links["dev"]) > MAX_LINK:
        raise SystemExit(f"The link would be {len(links['dev']):,} characters, too long to open. Ask Claude for a file-based copy.")
    for which, link in links.items():
        print(f"\n{which}: {link}")
    if args.open:
        # The browser the ratings came from: that's the one you use the site in
        program = find_firefox() if browser == "firefox" else find_edge()
        if not program:
            raise SystemExit(f"Couldn't find {browser} to open the links: paste them into the address bar instead.")
        for which in args.open:
            subprocess.Popen([program, links[which]])  # a list, not a shell line: no length or quoting trouble


if __name__ == "__main__":
    main()

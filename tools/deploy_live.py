"""Puts the PC's latest Steam update on the live site, by hand.

The daily run is online now: .github/workflows/daily-steam.yml does the same on GitHub, with the PC off.
This script is the fallback from the PC (GitHub down, or a quick redeploy of the PC's data).

    python tools/deploy_live.py            build + deploy (about a minute)
    python tools/deploy_live.py --dry-run  only say what it would do
    python tools/deploy_live.py --log      writes to .deploy_live/deploy.log instead of the screen

It deploys the version you approved (the git tag `live`), never whatever is on main: unfinished work stays on
your PC. It keeps a second copy of the repo at that tag next to this one (../anything-scout-live), copies in
today's Steam files (they aren't in git), and runs the same command you'd run by hand: `npm run deploy:golive`.
If nothing changed since the last deploy (same `live` version, same Steam update) it does nothing.

A failed run leaves the site as it was (yesterday's prices).
"""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LIVE_COPY = REPO.parent / "anything-scout-live"
STEAM = Path("web") / "public" / "data" / "games" / "steam"
STATE = REPO / ".deploy_live"  # git-ignored: the log and what was deployed last
# update_steam.py's daily files (games.20261115-090318.json, ...) and latest.json, which points at them
DAILY = re.compile(r"^((games|tags|tag_weights|prices)\.\d{8}-\d{6}\.(json|f32)(\.tmp)?|latest\.json)$")


def fresh_files(latest):
    """latest.json plus every file it names: what the live copy needs from today's update."""
    return ["latest.json"] + sorted(set(latest.get("files", {}).values()))


def stale_data(names):
    """Yesterday's daily files in the live copy, removed before today's go in (so they don't pile up online)."""
    return sorted(n for n in names if DAILY.match(n))


def stamp(commit, latest):
    """What a deploy puts online: the live version + which Steam update. Same stamp = nothing new to deploy."""
    return f"{commit} {latest.get('updated')} {json.dumps(latest.get('files', {}), sort_keys=True)}"


def base_mismatch(main_games, live_games):
    """Base files that differ between this checkout's Games data and the live copy's (paths like "steam/nbr_idx.u16").
    update_steam.py builds today's files on top of THIS checkout's base (the player links point at games by
    position), so if the live version's base differs, today's files don't belong with it."""
    def base(root):
        files = {"platforms.json": root / "platforms.json"}
        steam = root / "steam"
        if steam.is_dir():
            files.update({f"steam/{p.name}": p for p in steam.iterdir() if p.is_file() and not DAILY.match(p.name)})
        return files
    mine, theirs = base(main_games), base(live_games)
    return sorted(name for name in mine.keys() | theirs.keys()
                  if name not in mine or name not in theirs or mine[name].read_bytes() != theirs[name].read_bytes())


def setup_output(log):
    """Where the messages go. pythonw (the Windows task) has no console at all (sys.stdout is None), so with a
    log everything goes there, opened before anything else can fail."""
    if log:
        log.parent.mkdir(parents=True, exist_ok=True)
        mode = "w" if log.exists() and log.stat().st_size > 1_000_000 else "a"
        sys.stdout = sys.stderr = open(log, mode, encoding="utf-8", buffering=1)
    elif sys.stdout is not None:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # wrangler prints emoji; this PC's console is cp932


def plan(live, install):
    """The npm commands, in order: install where the lock file changed, then the approved deploy command."""
    npm = shutil.which("npm") or "npm"
    steps = [(live / part, [npm, "ci"]) for part in ("web", "worker") if part in install]
    return steps + [(live / "worker", [npm, "run", "deploy:golive"])]


def run(cmd, cwd):
    print(f"> {' '.join(str(c) for c in cmd)}   (in {cwd})", flush=True)
    done = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    tail = (done.stdout + done.stderr).strip().splitlines()[-12:]
    print("\n".join("  " + line for line in tail), flush=True)
    if done.returncode:
        raise SystemExit(f"Failed ({done.returncode}): {' '.join(str(c) for c in cmd)}. The site keeps its last version.")
    return done.stdout


def git(*args, cwd=REPO):
    return run(["git", *args], cwd).strip()


def refresh_copy(dry):
    """../anything-scout-live checked out at the `live` tag (made the first time)."""
    if dry:
        print(f"would check out tag live ({git('rev-parse', '--short', 'live')}) in {LIVE_COPY}")
        return
    if not (LIVE_COPY / ".git").exists():
        git("worktree", "prune")
        git("worktree", "add", "--detach", str(LIVE_COPY), "live")
    else:
        git("checkout", "--force", "--detach", "live", cwd=LIVE_COPY)


def lock_hash(part):
    lock = LIVE_COPY / part / "package-lock.json"
    return hashlib.sha256(lock.read_bytes()).hexdigest() if lock.exists() else ""


def lock_changes(state):
    """Which of web/worker need `npm ci`: no node_modules yet, or package-lock.json changed since last time."""
    return [part for part in ("web", "worker")
            if not (LIVE_COPY / part / "node_modules").exists() or state.get(f"lock_{part}") != lock_hash(part)]


def main():
    dry = "--dry-run" in sys.argv
    setup_output(STATE / "deploy.log" if "--log" in sys.argv else None)
    print(f"\n===== {datetime.now():%Y-%m-%d %H:%M} =====", flush=True)

    latest = json.loads((REPO / STEAM / "latest.json").read_text(encoding="utf-8"))
    commit = git("rev-parse", "live")
    state_file = STATE / "last.json"
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    now = stamp(commit, latest)
    if state.get("stamp") == now:
        print("Nothing new since the last deploy (same live version, same Steam update): done.")
        return

    refresh_copy(dry)
    if (LIVE_COPY / STEAM).parent.is_dir():
        changed = base_mismatch(REPO / STEAM.parent, LIVE_COPY / STEAM.parent)
        if changed:
            raise SystemExit(f"Games base data changed since the live version ({', '.join(changed[:4])}): today's Steam "
                             "files are built on the new base, so they can't go out with the old one. Move the live "
                             "tag (with your OK) first. The site keeps its last version.")
    elif not dry:
        raise SystemExit(f"The live version ({commit[:7]}) has no Games data: move the live tag first.")
    steam = LIVE_COPY / STEAM
    names = fresh_files(latest)
    if dry:
        print(f"would replace {len(stale_data(p.name for p in steam.glob('*'))) if steam.exists() else 0} old daily files "
              f"with {len(names)} from today ({latest.get('updated')})")
    else:
        for name in stale_data(p.name for p in steam.iterdir()):
            (steam / name).unlink()
        for name in names:
            shutil.copy2(REPO / STEAM / name, steam / name)
    install = ["web", "worker"] if dry else lock_changes(state)
    for cwd, cmd in plan(LIVE_COPY, install):
        if dry:
            print(f"would run: {' '.join(Path(cmd[0]).name if i == 0 else c for i, c in enumerate(cmd))}   (in {cwd})")
        else:
            run(cmd, cwd)
    if dry:
        return

    for part in ("web", "worker"):
        state[f"lock_{part}"] = lock_hash(part)
    state["stamp"] = now
    state["deployed"] = datetime.now().isoformat(timespec="seconds")
    state_file.write_text(json.dumps(state, indent=1), encoding="utf-8")
    print(f"Live: version {commit[:7]}, Steam data from {latest.get('updated')}.")


if __name__ == "__main__":
    main()

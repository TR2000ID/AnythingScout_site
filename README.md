# AnythingScout_site

One website for game, anime and (later) manga recommendations: a service switch at the top
(**Games · Anime · Manga & Comics**), each section with its own pages.
"Anything Scout" is only the repo name; the site's public name isn't picked yet.

The data work stays in its own repos, which write into this one:
- **Anime:** Anime Scout's `export_web.py` → `web/public/data/anime/`
- **Games:** Game Scout's `export_web.py`, `import_steam.py` and `update_steam.py` → `web/public/data/games/`
  (`site_files.py` there; the repos sit side by side in `C:\Users\PC_User\Projects`). The daily Steam
  update (Windows task, 04:00) writes dated files + `steam/latest.json`, which git ignores; git keeps a
  plain-named starting copy.

## Run it on your PC

```
cd worker && npm ci && npm run dev    # the small server (/api/watch, /api/account), port 8789
cd web && npm ci && npm run dev       # the site, http://localhost:5185/
```

Once, before the first `npm run dev` in `worker/` (and again after a new file in `worker/migrations/`):
`npm run db:local`. It makes the accounts tables in wrangler's own local test database
(`worker/.wrangler/`), so the PC site never touches the live accounts.

**Update now** (Games → Settings, or Steam sales) works only here on the PC: the dev server runs Game Scout's
`update_steam.py` (~7–10 min) in the `game-scout` repo next to this one (`GAME_SCOUT_REPO=<folder>` points
elsewhere).

Tests: `npm test` in `web/` and in `worker/`. Browser checks (need both servers running, and a Python
with Playwright: the global `python`, not Anime Scout's venv):
`python tests\browser\shell_check.py <folder for screenshots>`
(also `games_check`, `carry_check`, `site_check`, `import_check`, `together_check`, `watch_check`,
`calendar_check`; `update_check` runs a real ~10-minute Steam update).

## Your Game Scout ratings (one-time copy)

Game Scout ran at `localhost:5181`, and browsers keep each address's saved data apart.
`python tools\read_game_ratings.py` reads them from a copy of your browser data (Firefox or Edge; nothing is
changed) and prints a link per site: `/games/carry#<your ratings>`. Opening it writes them in exactly, and
asks before replacing different ratings. `--open dev` / `--open live` opens the link; `--compare` checks it
worked. Done 2026-11-15: 83 ratings from Firefox.

## Live site, and deploying

**Live** at https://anime-scout.nomikai-scout-worker.workers.dev (Anime Scout's address, so friends keep their
saved ratings; old `/#/...` links still work). Anime since 2026-11-15, **Games since 2026-11-15** (step 2);
Manga & Comics says "Soon". The git tag `live` marks the version that's online.

`npm run deploy` in `worker/` refuses on purpose (a test keeps it that way): it would send whatever is on main
live, unfinished work included. With your OK: `npm run deploy:golive`, then `git tag -f live && git push -f origin live`.
Anime Scout's own repo no longer deploys (its `npm run deploy` refuses too).
Roll back: `npx wrangler rollback` in `worker/` (`npx wrangler deployments list` shows the versions;
`399fed6b` = Anime only, `115a54f2` = the old Anime Scout).
Check the live site: set `SITE=https://anime-scout.nomikai-scout-worker.workers.dev`, then run the browser checks.

### Fresh Steam prices every morning

`python tools\deploy_live.py` puts the latest Steam update on the live site: it rebuilds the version tagged
`live` (in a second copy of the repo, `..\anything-scout-live`) with today's Steam files and deploys it, so
unfinished work never goes out. Nothing new → it does nothing. `--dry-run` shows the steps; `--log` writes to
`.deploy_live\deploy.log`.

It's meant to run right after Game Scout's 04:00 update, as a second action of the Windows task
"Game Scout - daily Steam update" (`pythonw.exe tools\deploy_live.py --log`, starting in this folder).
To stop it: Task Scheduler → that task → Actions → delete that line.

Design: `docs/superpowers/specs/2026-11-15-merge-design.md`.

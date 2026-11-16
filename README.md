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
`calendar_check`, `account_check`; `update_check` runs a real ~10-minute Steam update).

## Your Game Scout ratings (one-time copy)

Game Scout ran at `localhost:5181`, and browsers keep each address's saved data apart.
`python tools\read_game_ratings.py` reads them from a copy of your browser data (Firefox or Edge; nothing is
changed) and prints a link per site: `/games/carry#<your ratings>`. Opening it writes them in exactly, and
asks before replacing different ratings. `--open dev` / `--open live` opens the link; `--compare` checks it
worked. Done 2026-11-15: 83 ratings from Firefox.

## Accounts (optional)

Sign in / Create account sits at the right end of the top bar. **Username only, no password** (your call,
2026-11-15): anyone who knows a username can open that account, and the sign-in box says so. A password comes
later as the empty `password_hash` column: nothing moves, nobody is signed out.

- **What follows you:** Anime ratings, Anime settings, Watch together friends, Games ratings, Games settings
  (hidden items count as ratings). Everything still lives in the browser first (same saved keys as before), so
  the site works offline and signed out exactly as it always did.
- **How it syncs:** each rating is its own row with its date; the newer date wins, and removing a rating is a
  dated "removed" row, so it wins over an older rating on another device. Settings and the Watch together list
  are saved whole; the newer one wins. A sync runs on page load, 3 seconds after a change, when the tab comes back
  into view, and when the browser is back online. Code: `worker/src/account.ts` + `sync.ts` (server),
  `web/src/shell/account/` (browser: `engine.ts` = the merge rules, `runner.ts` = when and how).
- **First sign-in on a browser with ratings:** a new account takes them. An account that already has ratings asks
  "Add them to your account / Leave them out" (Leave = the account's lists replace this browser's, nothing of
  this browser's goes up: for a friend's computer).
- **Sign out:** the browser goes back to what it had before you signed in on it (its own lists were set aside at
  sign-in); the account keeps everything. Signing out on a friend's computer leaves nothing of yours there.
- **Guessing limit:** 20 unknown names per address per 10 minutes, 10 creates per address per hour (429 after).
- **Pictures:** cropped and shrunk to 128x128 in the browser, at most 50 KB, kept in D1.
- **Free limits (D1 free plan):** 5 GB stored, 5 million rows read and 100,000 rows written per day, 50 queries
  per request (a sync uses about a dozen however many ratings it carries). A few friends use a tiny fraction;
  nothing here needs a card.

**The PC site uses its own test database** (wrangler's local D1 in `worker/.wrangler/`), never the live one:
`npm run db:local` in `worker/` once (and after a new file in `worker/migrations/`). The live database is
`anything-scout` on Cloudflare.

**Remove an account** (there's no Delete button while anyone could press it):
`npx wrangler d1 execute anything-scout --remote --command "DELETE FROM users WHERE name='<exact name>'"` in
`worker/`. Capitals count. Its ratings, settings and sign-ins go with it (the tables cascade).

**Undo a bad sync or vandalism** (D1 Time Travel, free, the last 7 days): `npx wrangler d1 time-travel info
anything-scout` shows the current point; `npx wrangler d1 time-travel restore anything-scout
--timestamp=<ISO time before the problem>` puts the whole database back to that moment. Signed-in devices
notice on their next sync (they've seen a later revision than the account now has), take everything the account
holds again, and send back their own ratings that the restore took away.

Design: `docs/superpowers/specs/2026-11-15-accounts-design.md`, plan: `docs/superpowers/plans/2026-11-15-accounts.md`.

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

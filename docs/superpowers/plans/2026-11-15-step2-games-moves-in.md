# Combined Site, Step 2: Games Moves In — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (Tasks 7–8 added 2026-11-15: go live + daily refresh.) The combined site (`anything-scout`, port 5185) gets a working **Games** section at `/games/...` with everything Game Scout has today (platform switch, Steam sales, prices, My games, Update now). Game Scout's data scripts and the 04:00 task write into the new repo, and your Game Scout ratings come across intact.

**Architecture:** This step is a copy of Step 1, done for Games. Game Scout's `web/src` moves into `web/src/games/` almost untouched, and its data into `web/public/data/games/`. Hash pages (`#/sales`) become paths (`/games/sales`) on the shell's `routeStore`, and `"games"` joins `READY`. Each section's data downloads only when that section is first opened. The "Update now" dev plugin moves in and still runs `update_steam.py` inside the `game-scout` repo. That repo's scripts write into the new repo through one path in `site_files.py`. Ratings come across in two parts: a script reads them from a *copy* of your Edge profile, then a dev-only page on 5185 writes them into the new site, inside your own Edge.

**Tech Stack:** Same as Step 1: React 19, TypeScript 7, Vite 8, vitest 5, Python 3 (pytest in game-scout), Playwright + Edge (global `python`) for browser checks.

**Spec:** `03 Projects/(C) Combined Site — Merge Design.md` (approved 2026-11-15), Steps → 2, plus "Claude's calls". Step 1's plan (`(C) Combined Site — Step 1 Plan.md`) shows the pattern this plan repeats.

## Global Constraints

- **Repos:**
  - `C:\Users\PC_User\Projects\anything-scout` (remote TR2000ID/AnythingScout_site, branch main).
  - `C:\Users\PC_User\Projects\game-scout` (branch main).
  - Commit and push both after every task. Messages end with the session's Co-Authored-By and Claude-Session lines.
- **Deploy only in Task 7/8** (user's OK 2026-11-15, "Just do it to cloudflare"). Until then `npm run deploy` stays guarded and `deploy:golive` is not run. Game Scout's `.github/workflows/deploy.yml` stays as it is: it's manual-only and is retired in its README in Task 6.
- **Copy, don't move:** `game-scout/web` stays and keeps working on 5181, with data frozen from today.
- **Saved-data keys stay exactly** `game-scout.ratings` and `game-scout.settings` (and Anime's three keys, `anything-scout.section`).
- **First visit with nothing saved lands on Games.** Anyone with Anime ratings lands on Anime; a saved last section wins over both (`homeFor`, already written and tested).
- **The Windows task "Game Scout - daily Steam update"** keeps its own settings (`pythonw.exe update_steam.py --log`, cwd `game-scout`). Don't edit the task: the redirect happens inside `site_files.py`.
- **Look:** same tokens; no emoji; no new colors. Both sections' `styles.css` load together until step 3 merges them.
- **Settings stay per section until step 3.** The service bar reads the language of the section on screen: Games → Games' setting, otherwise Anime's.
- **Free only.** `update_steam.py` calls Steam's free store API (~10 min); that is allowed.
- **Vault:** only `(C)` files may be edited. That covers `(C) Open Game Scout Site.cmd` and the merge design's Steps line. Game Scout's `COMMANDS.md` / `CLAUDE.md` are not `(C)`: list the lines that are now stale in the final report instead of editing them.

## Review Focus

1. **Each section downloads only its own data.** Opening `/games/` first must not fetch `/data/anime/*` (several MB), and `/anime/` first must not fetch `/data/games/*` (~18 MB). → `shell_check.py` records requests (Task 3/6).
2. **The 04:00 run writes into the new repo.** If `anything-scout` isn't there, it must stop with a clear message rather than quietly creating folders (Step 1's deferred minor; don't repeat it here). → `check_site` tests (Task 2) + a real update through the button (Task 4).
3. **Ratings arrive byte-for-byte**, including Japanese titles and a value containing `</script>`. They never silently replace different ratings that are already on 5185. → `carry.test.ts` + `carry_check.py` (Task 5).
4. **Two stylesheets together change neither section's look.** No selector may appear in both files with different rules. → diff check in Task 1; Anime's 6 browser checks re-run in Task 6.
5. **Back/Forward across sections:** `/games/sales` → Anime tab → Back must show Sales again, not Games' For you. Each section's page store follows the address only while that section is on screen. → `shell_check.py` (Task 6).

---

### Task 1: Game Scout's site copied in (builds, not yet reachable)

**Files:**
- Create by copying from `game-scout/web` (leave out `node_modules`, `dist`, `*.tsbuildinfo`):
  - `src/*` except `main.tsx` → `web/src/games/*`
  - `public/data/*` → `web/public/data/games/*`, including today's dated Steam files and `latest.json`, so the dev site shows today's prices
  - `update-plugin.ts` → `web/update-plugin.ts`
- Modify:
  - `web/src/games/lib/data.ts:99`: `DATA` → `${import.meta.env.BASE_URL}data/games/`
  - `.gitignore`: add `web/public/data/games/steam/*.[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].*`, `web/public/data/games/steam/latest.json`, `web/public/data/games/**/*.tmp`, `web/.carry/`
  - `docs/superpowers/plans/2026-11-15-step2-games-moves-in.md`: copy of this plan

**Interfaces:**
- Produces: `web/src/games/App.tsx` `App`, `web/src/games/lib/data.ts` `loadData()`, `web/src/games/state/settings.ts` `settingsStore`/`useSettings`, `web/src/games/state/ratings.ts` `ratingsStore`. Data is served at `/data/games/platforms.json` and so on.

- [ ] **Step 1:** Copy the files. `git status` should show the plain-named Steam files (`games.json`, `tags.json`, `tag_weights.f32`, `prices.json`, `nbr_*`) as new, and no dated files or `latest.json`.
- [ ] **Step 2: Style check.** List every selector that appears in both `web/src/anime/styles.css` and `web/src/games/styles.css` with different rules. Expected: none. Today's diff is additions only: each file has its own extras (`.price*`, `.updater*`, `.check` / `.new-badge`, `.person`, …). If any turn up, keep Anime's rule for that selector, ledger it, and list it for step 3.
- [ ] **Step 3:** `npm run build` in `web/` → no type errors, with `games/` compiled through a temporary import. `npm test` → 16/16 still.
- [ ] **Step 4:** Commit "Game Scout's site copied in (not wired yet)" and push.

### Task 2: Game Scout's scripts write into the new repo

**Files (game-scout):**
- Modify: `site_files.py`, `export_web.py:29-31`, `import_steam.py:36-37`, `update_steam.py:45-47`, `README.md` (data section)
- Test: `tests/test_core.py`

**Interfaces:**
- Produces: `site_files.SITE_DATA: Path`. It is `Path(os.environ["ANYTHING_SCOUT_DATA"])` when the setting exists, otherwise `Path(__file__).resolve().parent.parent / "anything-scout" / "web" / "public" / "data" / "games"`. The default is relative to the repo, not the current folder.
- Produces: `site_files.check_site(out: Path) -> None`. It raises `SystemExit` naming the path and `ANYTHING_SCOUT_DATA` when `out` or `out / "platforms.json"` is missing.
- Each script sets `OUT = SITE_DATA` and calls `check_site(OUT)` first thing in its `main()`. `update_steam.STEAM`/`LATEST` still derive from `OUT`.

- [ ] **Step 1: Failing tests:**
  - `test_site_data_default_is_the_combined_site`: with no env var (reload `site_files`), `SITE_DATA == <game-scout>/../anything-scout/web/public/data/games`
  - `test_site_data_follows_the_setting`: monkeypatch env and reload → equals the env path (reload again on teardown)
  - `test_scripts_write_to_site_data`: `export_web.OUT`, `import_steam.OUT`, `update_steam.OUT` all `== site_files.SITE_DATA`, and `update_steam.STEAM == SITE_DATA / "steam"`
  - `test_check_site_stops_without_the_site`: `check_site(tmp_path / "nope")` raises `SystemExit` whose text contains `ANYTHING_SCOUT_DATA`, and nothing is created
- [ ] **Step 2:** `.venv\Scripts\python -m pytest` → the 4 new tests FAIL; the old ones pass.
- [ ] **Step 3:** Implement. In the 4 Python files' comments and docstrings, change "web/public/data" to "the site's data folder (site_files.SITE_DATA)". In README, say the data now lives in the combined site, and that the 5181 site keeps the copy from 2026-11-15.
- [ ] **Step 4:** `.venv\Scripts\python -m pytest` → all pass. Then run `.venv\Scripts\python -c "import update_steam; print(update_steam.STEAM)"` → prints the anything-scout path.
- [ ] **Step 5:** Commit (game-scout) "Data scripts write into the combined site (anything-scout)" and push.

### Task 3: Games is a real section at `/games/...`

**Files (anything-scout):**
- Modify: `web/src/games/state/ui.ts`, `web/src/shell/route.ts` (`READY`), `web/src/shell/Shell.tsx`, `web/src/shell/ServiceBar.tsx`, `web/src/main.tsx`, `web/src/shell/texts.ts` (drop `soonGamesTitle`/`soonGames` and Soon's `"games"` case)
- Create: `web/src/shell/sections.ts`, `web/src/shell/sections.test.ts`, `web/src/games/state/ui.test.ts`

**Interfaces:**
- Consumes: `routeStore`, `navigate` (`shell/route.ts`); `loadData` from `anime/lib/data` and `games/lib/data`.
- Produces: in `games/state/ui.ts`, `pageFromPath(page: string): Page`, `hrefOf(page: Page): string` (`"/games/"` or `"/games/<page>"`), and `showPicks(platform?)` using `navigate`. Games' pageStore follows `routeStore` only while `section === "games"`, the same pattern as `anime/state/ui.ts`. The `hashchange` listener is removed.
- Produces: in `shell/sections.ts`, `onceEach(loaders: Partial<Record<Section, () => unknown>>): (section: Section) => void`. It calls each section's loader at most once, the first time that section is shown. It also exports `barLang(section: Section | undefined, anime: Lang, games: Lang): Lang`: games → `games`, otherwise `anime`.
- `READY = ["games", "anime"]`.

- [ ] **Step 1: Failing tests:**
  - `ui.test.ts`: `pageFromPath("sales") === "sales"`; `pageFromPath("") === "for-you"`; `pageFromPath("nope") === "for-you"`; `hrefOf("for-you") === "/games/"`; `hrefOf("liked") === "/games/liked"`
  - `sections.test.ts`: the loader runs once over `games, games, anime, games`, and anime's runs once too; a section with no loader (`manga`) is fine; `barLang("games","en","ja") === "ja"`, `barLang("anime","en","ja") === "en"`, `barLang(undefined,"en","ja") === "en"`
- [ ] **Step 2:** `npm test` → these FAIL.
- [ ] **Step 3:** Implement:
  - Shell renders `<Games />` for `games`.
  - `main.tsx` imports `games/styles.css` between Anime's and the shell's, and no longer calls `loadData()` at startup. Shell's effect calls the `onceEach` loader for `route.section`.
  - ServiceBar takes `lang` from Shell (`barLang(route?.section, animeSettings.lang, gamesSettings.lang)`). Shell sets `document.documentElement.lang` to it.
  - Update `route.test.ts`'s step-1 expectations only where `READY` changed.
- [ ] **Step 4:** `npm test` → all pass; `npm run build` → clean. Open `http://localhost:5185/games/sales` by hand: Sales renders with prices.
- [ ] **Step 5:** Commit "Games section at /games/: routes, lazy data per section, bar language follows the section" and push.

### Task 4: "Update now" works from the combined site

**Files:** modify `web/update-plugin.ts` and `web/vite.config.ts` (add `dataUpdater()`); create `web/update-plugin.test.ts`, `tests/browser/update_check.py`

**Interfaces:**
- Produces: `gameScoutRepo(env: string | undefined): string`. It returns `env` if set, otherwise `fileURLToPath(new URL("../../game-scout/", import.meta.url))`, which is web → anything-scout → Projects. Also `pythonFor(repo: string): string`, which picks the repo's `.venv` python, falling back to `"python"`.
- Behaviour: if `update_steam.py` isn't in the repo, POST returns a finished run with `ok: false` and the line `Game Scout's repo isn't at <path> (set GAME_SCOUT_REPO)`. The `x-game-scout` header and origin checks stay as they are.

- [ ] **Step 1: Failing tests (`update-plugin.test.ts`):** `gameScoutRepo("C:/x")` returns `"C:/x"`; `gameScoutRepo(undefined)` ends with `/Projects/game-scout/`; `pythonFor(<tmp dir without .venv>) === "python"`. Add `update-plugin.test.ts` to vitest's include if needed.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement and wire the plugin into `vite.config.ts`, then restart vite. **Step 4:** `npm test` → pass.
- [ ] **Step 5: Real update (~10 min, Steam's free API).** `update_check.py` notes `latest.json`'s `updated` value in both repos. It opens `/games/settings`, clicks Update now, and waits up to 20 min for the finished message. It then asserts:
  - anything-scout's `latest.json` changed
  - game-scout's `web/public/data/steam/latest.json` didn't change
  - cards still show on `/games/`
  - no page errors

  Expected: 4/4.
- [ ] **Step 6:** Commit "Update now runs Game Scout's update into this repo" and push.

### Task 5: Your Game Scout ratings come across

(Changed 2026-11-15 before starting: the user wants Games live, so the carry must also reach the live site. A dev-only page can't do that. The data now travels in the link's `#` part, which browsers never send to a server, and a Games page writes it.)

**Files:** create `web/src/games/lib/carry.ts`, `web/src/games/lib/carry.test.ts`, `web/src/games/pages/Carry.tsx`, `tools/read_game_ratings.py`, `tests/browser/carry_check.py`; modify `web/src/games/state/ui.ts` (page `"carry"`, not in the sidebar), `web/src/games/App.tsx`

**Interfaces:**
- `carry.ts`:
  - `interface CarryData { ratings: string; settings: string | null }`: the exact saved strings.
  - `encodeCarry(d: CarryData): string`: base64url of the UTF-8 JSON, no padding.
  - `decodeCarry(hash: string): CarryData | null`: accepts a leading `#`; null on anything malformed.
  - `planCarry(d: CarryData, existing: string | null): "write" | "same" | "ask"`: `ask` only when there are existing ratings that differ.
- Carry page `/games/carry#<data>`:
  - `write`: writes both keys, reads them back and compares with `===`, then shows "Copied N ratings" and a link to My games. The link is a full page load, so the stores read the new data.
  - `same`: says they're already there.
  - `ask`: shows both counts with **Replace** and **Keep these**.
  - With no or bad data: a short note. Afterwards the `#data` is cleared from the address (`history.replaceState`).
- `python tools/read_game_ratings.py [--user-data DIR] [--profile NAME] [--origin URL] [--out FILE] [--open]`:
  - Defaults: Edge's `User Data`; `Local State` → `profile.last_used`, or `Default`; origin `http://localhost:5181`; out `web/.carry/games.json`.
  - It copies `Local State` + `<profile>/Local Storage/leveldb/*` (not `LOCK`) to a temp folder; the real profile is only read. It opens the copy headless with Playwright msedge `--profile-directory`, routes the origin to a blank page, and reads `game-scout.ratings` / `game-scout.settings` as exact strings.
  - It writes the file, prints the count and the carry links for `http://localhost:5185` and the live site, and `--open` opens both in Edge (`start msedge <link>`). It exits 1 when there are no ratings.
  - Running it again with `--origin http://localhost:5185` (or the live URL) reads those back, to verify.

- [ ] **Step 1: Failing tests (`carry.test.ts`):**
  - A value containing `</script>`, `進撃` and `"quotes"` round-trips `encodeCarry` → `decodeCarry`.
  - `decodeCarry("#%%%")` and `decodeCarry("")` → null.
  - `planCarry`: no existing → `write`; same → `same`; different → `ask`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → pass.
- [ ] **Step 5: `carry_check.py`:**
  - Seed a temp Edge profile at 5181 with 3 ratings (Japanese title, a `</script>` value) plus settings.
  - Reader on it (`--user-data`, `--out` in scratch) → the file equals the seed.
  - Its 5185 link in a fresh browser → localStorage equals the seed exactly, and "Copied 3" shows.
  - Different ratings there → Replace is shown and nothing is overwritten. Click Replace → equal to the seed.
  - `/games/liked` lists them. The address no longer holds `#`.
- [ ] **Step 6: Your real ratings:**
  - Run the reader on your real profile and record the count.
  - `--open` the 5185 link (live comes in Task 7).
  - Re-read with `--origin http://localhost:5185` → identical.
  - Commit "One-time copy of Game Scout ratings" and push.

### Task 6: Checks, shortcut, docs

**Files:** create `tests/browser/games_check.py`; modify `tests/browser/shell_check.py`, `README.md`, `tests/browser/README.txt`, vault `Game Scout/(C) Open Game Scout Site.cmd`, vault merge design (Steps → 2 done line)

- [ ] **Step 1: `shell_check.py` updates:**
  - Nothing saved → `/` goes to `/games/`.
  - Only Manga carries a Soon pill.
  - `/games/` on a fresh page fetches nothing under `/data/anime/`, and `/anime/` on a fresh page fetches nothing under `/data/games/`.
  - Anime ratings saved but no section → `/anime/`.
  - `/games/sales` → Anime tab → Back → `/games/sales` showing Sales.
  - Games set to 日本語 while Anime is English: tabs read Japanese on `/games/` and English on `/anime/`.
  - Keep all the old checks, editing only expectations that `READY` changed.
- [ ] **Step 2: `games_check.py`:**
  - For you loads.
  - Search "Portal 2" → rate it Liked → it appears on `/games/liked`, and `game-scout.ratings` contains `steam:620`.
  - A rating saved under `game-scout.ratings` before load shows up.
  - The platform switch changes to PlayStation, then Xbox; Switch says it's coming later.
  - `/games/sales` lists games with prices, survives a reload, and the On sale filter works.
  - The details popup opens.
  - Settings shows Update now (dev).
  - On a phone (390px): no sideways scroll on `/games/` and `/games/sales`, and ☰ opens the drawer.
  - No page errors.

  Screenshots go to a scratch folder.
- [ ] **Step 3: Run everything:**
  - Web `npm test`, worker `npm test`, game-scout pytest.
  - Browser checks: `shell_check`, `games_check`, `carry_check`, Anime's `site_check`, `import_check`, `together_check`, `watch_check`, `calendar_check` (6/7 known, pre-existing).

  Expected: all green except calendar's known line. Look at the screenshots: Games looks like it did on 5181.
- [ ] **Step 4: Docs:**
  - Shortcut: `WEB=…\anything-scout\web`, `PORT=5185`, open `http://localhost:%PORT%/games/`, and drop the Steam Scout fallback.
  - README: the Games section, Update now, the carry-over page, the data folders.
  - Vault design: "Step 2 done <date>" with commits and results.
  - Memory: update `game-scout.md` and `anime-scout.md` plus their index lines.
- [ ] **Step 5:** Commit "Games checks, docs, shortcut" and push.

### Task 7: Games goes live (user's OK 2026-11-15: "Just do it to cloudflare")

- [ ] **Step 1:** All tests and checks from Task 6 green → `npm run deploy:golive` in `worker/`. Data is ~29 MB for Games + Anime; the largest file is 4.4 MB (limit 25 MB).
- [ ] **Step 2:** `SITE=<live> python tests/browser/shell_check.py` and `games_check.py` (Update now is dev-only: on live it must be absent), plus `site_check.py` → green.
- [ ] **Step 3:** `git tag -f live && git push -f origin live`.
- [ ] **Step 4:** Your ratings into the live site: open the live carry link in Edge, then re-read with `--origin <live>` → identical.

### Task 8: The 04:00 update also refreshes the live site

The spec: the daily task rebuilds the version marked `live` plus the fresh Steam files.

**Files:** create `tools/deploy_live.py`, `tools/test_deploy_live.py`; modify the Windows task "Game Scout - daily Steam update" (add a second action), `README.md`

**Interfaces:**
- `deploy_live.py [--log] [--dry-run]`:
  1. Refresh a worktree of tag `live` at `<repo>/../anything-scout-live` (`git worktree add`/`checkout --force live`).
  2. Copy into it `web/public/data/games/steam/latest.json` plus every file it names under `files` (from the main checkout).
  3. `npm ci` in its `web/` and `worker/` when `package-lock.json` changed since the last run (cache the hash in `.deploy_live/`, gitignored).
  4. `npm --prefix web run build`, then `npx wrangler deploy` in its `worker/`.
  5. `--log` appends to `<repo>/.deploy_live/deploy.log`. It exits non-zero on any failure; yesterday's deploy stays live.
- Pure helpers: `fresh_files(latest: dict) -> list[str]` (`latest.json` + the `files` values, sorted, no duplicates) and `plan(dry: bool) -> list[list[str]]` (the commands, in order).

- [ ] **Step 1:** Failing pytest (`tools/test_deploy_live.py`, global python): `fresh_files` of a sample `latest.json` and of one without `files`; `plan()` ends with the wrangler deploy run in the worktree's `worker`, and builds before deploying.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** `--dry-run` prints the steps. Then one real run → the live site still passes `shell_check`, with today's prices.
- [ ] **Step 4:** Add action 2 to the task (`pythonw.exe <anything-scout>\tools\deploy_live.py --log`, using the global python) with `Set-ScheduledTask`. Show the task's actions → both are there. The README explains how to turn it off.
- [ ] **Step 5:** Commit and push. Then run the final whole-branch review (most capable model) over both repos' ranges.

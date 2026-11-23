# Daily Steam Update Online: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub Actions workflow in AnythingScout_site that runs Game Scout's `update_steam.py` every day at
04:00 JST and deploys the `live` tag to Cloudflare, so the PC can be off.

**Architecture:** One workflow, one job: two checkouts side by side (this repo at tag `live`, Game_Scout `main`
via a read-only deploy key) → Python update writes today's Steam files into the live checkout → `npm ci` +
`npm run deploy:golive`. No code changes to the update itself. Comments that point at the old plan get updated.

**Tech Stack:** GitHub Actions (ubuntu-latest), Python 3.14 + numpy 2.5.3 + requests 2.34.2, Node 24 / npm 11,
wrangler 4.142.0 (from worker/package-lock.json).

**Spec:** `docs/superpowers/specs/2026-11-23-daily-update-online-design.md`

## Global Constraints

- ¥0: GitHub-hosted Linux runner only (not Windows/macOS, which use up minutes faster), one run a day plus manual runs.
- Deploy the `live` tag only, never `main`.
- If the update fails, nothing deploys (steps run in order, a failed step stops the job).
- Secrets never pass through the chat: `CLOUDFLARE_API_TOKEN`, `GAME_SCOUT_DEPLOY_KEY`. The account ID
  `e92560e72e373929993087baeff73889` is not a credential and sits in the workflow as plain env.
- Action versions as Game Scout's existing workflow already uses: `actions/checkout@v5`,
  `actions/setup-python@v6`, `actions/setup-node@v5`.
- Job timeout 45 min (same as the Windows task).

## Review Focus

1. **Scheduled run picks the wrong code:** a schedule runs the workflow file from `main`, but the checkout must
   be `ref: live`. Rehearsal (Task 1 Step 3) checks out `live` the same way.
2. **Update writes into the wrong folder** (next to game-scout instead of the live checkout):
   `ANYTHING_SCOUT_DATA` must be absolute. Rehearsal asserts `latest.json` appears in the live checkout.
3. **Two runs at once** (a manual run during the scheduled one): `concurrency` group `daily-steam`,
   `cancel-in-progress: false`.
4. **Steam answers GitHub's servers with 429s / blocks:** the script already backs off. The first manual run
   (Task 3) is the check; if it fails, stop and report instead of tuning blindly.
5. **Top-of-hour schedule delays:** cron `17 19 * * *` (04:17 JST), not `0 19`.

---

### Task 1: The workflow + a local rehearsal

**Files:**
- Create: `.github/workflows/daily-steam.yml`
- Scratchpad only (not committed): `rehearse.sh`

**Interfaces:**
- Produces: workflow `Daily Steam update` with triggers `schedule: "17 19 * * *"` and `workflow_dispatch`;
  checkouts at `$GITHUB_WORKSPACE/anything-scout` (ref `live`) and `$GITHUB_WORKSPACE/game-scout`
  (repository `TR2000ID/Game_Scout`, `ssh-key: ${{ secrets.GAME_SCOUT_DEPLOY_KEY }}`).

- [ ] **Step 1: Write the rehearsal** (scratchpad `rehearse.sh`): the workflow's run steps against fresh clones:
  `git clone --branch live` of the local anything-scout + `git clone` of the local game-scout into an empty
  scratchpad folder; a fresh venv with `numpy==2.5.3 requests==2.34.2`; `ANYTHING_SCOUT_DATA=<abs>/anything-scout/web/public/data/games python game-scout/update_steam.py`;
  `npm ci` in web/ and worker/; `npm --prefix web run build` (build only: no deploy).
  Passes when: update exits 0, `anything-scout/web/public/data/games/steam/latest.json` exists in the CLONE,
  the real anything-scout's `latest.json` is unchanged, and `web/dist/data/games/steam/latest.json` exists.
- [ ] **Step 2: Write `.github/workflows/daily-steam.yml`**: steps = checkout ×2 → setup-python 3.14 →
  `pip install numpy==2.5.3 requests==2.34.2` → update (env `ANYTHING_SCOUT_DATA: ${{ github.workspace }}/anything-scout/web/public/data/games`,
  `PYTHONUNBUFFERED: 1`) → setup-node 24 with npm cache on both lockfiles → `npm ci` web + worker →
  `npm run deploy:golive` in worker with env `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
  `permissions: contents: read`. Header comment in the repo's plain style: what, when, how to run it by hand,
  how to stop it, what happens on failure.
- [ ] **Step 3: Run the rehearsal, then parse the workflow**
  Run: `bash rehearse.sh` and `python -c "import yaml; yaml.safe_load(open('.github/workflows/daily-steam.yml'))"`
  Expected: all four pass conditions from Step 1; YAML loads.
- [ ] **Step 4: Commit + push** (`.github/workflows/daily-steam.yml`). A scheduled run before the secrets exist fails
  at the Game_Scout checkout and deploys nothing. That's harmless, and GitHub emails about it.

### Task 2: Point the old notes at the new run

**Files:**
- Modify: `anything-scout/tools/deploy_live.py` docstring (now the by-hand / PC fallback; the daily deploy is the workflow)
- Modify: `anything-scout/README.md` (a short "Daily Steam update" section: where it runs, Run workflow button, secrets' names)
- Modify: `game-scout/.github/workflows/deploy.yml` header (replaced by AnythingScout_site's daily-steam.yml; kept manual-only)
- Modify: `game-scout/update_steam.py:10` and `game-scout/site_files.py` docstring (GitHub run = AnythingScout_site's daily-steam.yml)

- [ ] **Step 1: Edit the five notes.** Comments only, no code changes.
- [ ] **Step 2: Run game-scout's tests** `python -m pytest -q` (game-scout venv). Expected: same pass count as before.
- [ ] **Step 3: Commit + push both repos.**

### Task 3: Keys, first run, switch-over (needs the owner)

- [ ] **Step 1 (Claude):** `ssh-keygen -t ed25519 -N "" -C "AnythingScout_site daily run (read-only)" -f <scratchpad>/game_scout_deploy_key`.
  Show the PUBLIC key in chat. Never print the private key: point the owner at the file.
- [ ] **Step 2 (owner):** Game_Scout → Settings → Deploy keys → Add (public key, write access OFF).
  AnythingScout_site → Settings → Secrets and variables → Actions → `GAME_SCOUT_DEPLOY_KEY` (private key file's contents).
  Cloudflare → My Profile → API Tokens → template "Edit Cloudflare Workers" → `CLOUDFLARE_API_TOKEN`.
  If the GitHub account has a card on file: Billing → Actions budget $0, stop usage.
- [ ] **Step 3 (owner or Claude):** Actions tab → Daily Steam update → Run workflow. Expected: green in ~10–12 min.
  If the deploy step fails for a D1 permission, add "D1: Edit" to the token and run again.
- [ ] **Step 4 (Claude):** live check: `curl` `/data/games/steam/latest.json` shows the run's `updated` time; `/games/` returns 200.
  Delete the scratchpad private key once the secret is saved.
- [ ] **Step 5 (after 3 good scheduled runs, with the owner's OK):** delete the Windows task "Game Scout - daily Steam update".

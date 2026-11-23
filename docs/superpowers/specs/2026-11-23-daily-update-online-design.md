# Daily Steam update, online — design (short)

Date: 2026-11-23. Status: draft, waiting for the owner's OK.

## Why

The owner wants everything to run online so their PC can be off and the sites still stay up to date, at ¥0.
Today the only job that needs the PC is Game Scout's 04:00 Windows task (`update_steam.py`): Steam prices,
sales, new games, tags. Its output never reached the live site on its own (`tools/deploy_live.py` was never
added to the task), so live prices only change when someone deploys by hand.

## Goals / non-goals / anti-goals

- **Goal:** every day at 04:00 JST, with the PC off, the live Games section gets that day's Steam data.
- **Goal:** ¥0. GitHub Actions (private repo, ~10 min/day ≈ 300 of the ~2,000 free Linux minutes a month) +
  Cloudflare Workers free plan. No card needed; at a limit, runs stop instead of billing.
- **Non-goal:** hourly prices (that's option B / combined-site step 1c, a later project on top of this one).
- **Non-goal:** changing what `update_steam.py` computes, or the dev-only "Update now" button on the PC.
- **Anti-goal:** unfinished work on `main` going live. The run deploys the approved `live` tag only, as
  `deploy_live.py` does today.
- **Anti-goal:** a bad Steam day breaking the site. If the update fails, nothing deploys and yesterday's site
  stays up.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A (picked)** | GitHub Actions runs the existing Python daily, then deploys to Cloudflare | Least new code, same daily freshness as now |
| B | A + a Cloudflare cron Worker refreshing prices hourly into D1 | Fresher sales, clearly more work. Comes later, on top of A |
| C | Cloudflare only | Ruled out: the free plan can't run the heavy part (new games, tag math) |

The owner said "go for the completely free options". Both A and B are free, so A goes first and B follows as
its own project (Claude's call, stated to the owner).

## Design

- **Where:** a new workflow `.github/workflows/daily-steam.yml` in **AnythingScout_site** (the repo that owns
  the live site). Triggers: `schedule` cron `0 19 * * *` (= 04:00 JST) + `workflow_dispatch` (a manual
  "Run workflow" button = the online "Update now").
- **Steps:** check out AnythingScout_site at the **`live` tag** → check out **Game_Scout** `main` next to it
  (read-only) → Python 3.14 + `numpy requests` → `python update_steam.py` with `ANYTHING_SCOUT_DATA` pointing at
  the live checkout's `web/public/data/games` → `npm ci` in web/ and worker/ → `npm run deploy:golive` in
  worker/ using the Cloudflare secrets.
- Because the update builds on the `live` tag's own base files, the base-mismatch problem `deploy_live.py`
  guards against can't happen here.
- **Secrets (the owner adds them on github.com; they never go through the chat):**
  - `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers"; D1 permission added only if the deploy asks
    for it) + `CLOUDFLARE_ACCOUNT_ID`.
  - `GAME_SCOUT_DEPLOY_KEY`: a read-only **deploy key** on Game_Scout (Claude's call over a personal token:
    it covers one repo, can only read, and never expires). Claude makes the key pair on the PC. The owner
    pastes the public half into Game_Scout → Deploy keys and the private half into the secret.
- **When it fails:** GitHub emails the owner about a failed scheduled run. The site keeps the last good data.
- **Go-live order:** one manual test run first (checks that Steam answers GitHub's servers without blocking,
  and that the deploy works) → live check of the Games page → the daily schedule runs for 3 days → the owner
  OKs deleting the Windows task (and Game Scout's dormant GitHub Pages `deploy.yml` gets marked replaced).
- **Free-plan safety:** if the owner's GitHub account has a payment card on file, set the Actions budget to
  $0 + "stop usage" (Settings → Billing).

## Left to the builder

Exact action versions (pinned, ≥2 weeks old), caching npm, the job timeout (45 min, like the Windows task),
whether `update_steam.py` needs any change to run on Linux (lock file, paths), and the README / COMMANDS
notes.

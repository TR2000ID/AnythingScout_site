# AnythingScout_site

One website for game, anime and (later) manga recommendations: a service switch at the top
(**Games · Anime · Manga & Comics**), each section with its own pages.
"Anything Scout" is only the repo name; the site's public name isn't picked yet.

The data work stays in its own repos: Anime Scout's `export_web.py` writes into `web/public/data/anime/`.

## Run it on your PC

```
cd worker && npm ci && npm run dev    # the small server (/api/watch), port 8789
cd web && npm ci && npm run dev       # the site, http://localhost:5185/
```

Tests: `npm test` in `web/` and in `worker/`. Browser checks (need both servers running, and a Python
with Playwright: the global `python`, not Anime Scout's venv):
`python tests\browser\shell_check.py <folder for screenshots>`
(also `site_check`, `import_check`, `together_check`, `watch_check`, `calendar_check`).

## Live site, and deploying

**Live since 2026-11-15** at https://anime-scout.nomikai-scout-worker.workers.dev (Anime Scout's address, so
friends keep their saved ratings; old `/#/...` links still work). Anime is there; Games and Manga & Comics show
"Soon" until their steps are done. The git tag `live` marks the version that's online.

`npm run deploy` in `worker/` refuses on purpose (a test keeps it that way): it would send whatever is on main
live, unfinished work included. With your OK: `npm run deploy:golive`, then `git tag -f live && git push -f origin live`.
Anime Scout's own repo no longer deploys (its `npm run deploy` refuses too).
Roll back: `npx wrangler rollback` in `worker/` (the version before the combined site: `115a54f2`).
Check the live site: set `SITE=https://anime-scout.nomikai-scout-worker.workers.dev`, then run the browser checks.

Design: `docs/superpowers/specs/2026-11-15-merge-design.md`.

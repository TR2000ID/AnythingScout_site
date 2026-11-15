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

## Do NOT deploy yet

The Worker is named `anime-scout` on purpose (go-live, step 4, keeps the live Anime Scout address
so friends keep their saved ratings). Deploying now would **replace the live Anime Scout site**, so
`npm run deploy` in `worker/` refuses on purpose (a test keeps it that way). The real command waits as
`npm run deploy:golive` for step 4, with your OK.

Design: `docs/superpowers/specs/2026-11-15-merge-design.md`.

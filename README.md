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

Tests: `npm test` in `web/` and in `worker/`. Browser checks (need both servers running):
`..\anime-scout\.venv\Scripts\python.exe tests\browser\site_check.py <folder for screenshots>`
(also `import_check`, `together_check`, `watch_check`, `calendar_check`).

## Do NOT deploy yet

The Worker is named `anime-scout` on purpose (go-live, step 4, keeps the live Anime Scout address
so friends keep their saved ratings). Running `npm run deploy` now would **replace the live Anime Scout site**.

Design: `docs/superpowers/specs/2026-11-15-merge-design.md`.

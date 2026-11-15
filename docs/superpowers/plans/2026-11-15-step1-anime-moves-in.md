# Combined Site, Step 1: New Repo + Anime Moves In — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new repo `anything-scout` runs one site on port 5185 with the service switch (Games · Anime · Manga & Comics) in the top bar; Anime works exactly as on Anime Scout today at `/anime/...`; Games and Manga & Comics show "Soon".

**Architecture:** One Vite + React app (`web/`). Anime Scout's whole `web/src` moves into `web/src/anime/` almost untouched; a small `web/src/shell/` adds the service bar, path routing (`/anime/liked` instead of `#/liked`, old `#/` links redirected) and the Soon pages. Anime's Worker (`/api/watch`) moves into `worker/` with SPA fallback so deep links load. Anime Scout's `export_web.py` writes its data into `anything-scout/web/public/data/anime/`.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Radix UI, lucide-react, vitest 5 (web + worker), Cloudflare Workers (wrangler 4.142.0), Python 3 + Playwright (Edge) for browser checks.

**Spec:** `03 Projects/(C) Combined Site — Merge Design.md` (approved 2026-11-15). Read its "Claude's calls" and "Steps" sections.

## Global Constraints

- Repo: `C:\Users\PC_User\Projects\anything-scout`, remote `https://github.com/TR2000ID/AnythingScout_site.git` (has GitHub's starter commit with a one-line README: build on top of it, don't force-push).
- Dev port **5185**, `strictPort: true`. Worker dev port **8789** (same as Anime Scout's today).
- Top bar order: **Games · Anime · Manga & Comics**. In step 1 Games and Manga & Comics are "Soon".
- Saved-data keys stay exactly `anime-scout.ratings`, `anime-scout.settings`, `anime-scout.friends`. New key: `anything-scout.section` (last section used).
- Site name is undecided: use the placeholder constant `SITE_NAME = "Anything Scout"` in exactly one file (`web/src/shell/texts.ts`).
- **No deploy in step 1.** The Worker keeps `name = "anime-scout"` (needed for step 4) — so running `npm run deploy` would replace the live Anime Scout site. Don't run it.
- Look: same tokens as today (dark, amber accent `#eca44a`); no emoji, no new colors.
- Existing tests keep their assertions; only their file paths / URLs change. Every new test is shown failing first.
- Commit and push after every task (`git push origin main`), messages end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Copy, don't move: `anime-scout/web` and `anime-scout/worker` stay as they are (the spec retires them after go-live).

## Review Focus

1. **Old bookmarks**: `/#/liked`, `/#/together`, `/?cal#/liked` must open the same Anime page at `/anime/liked`, `/anime/together`, `/anime/liked?cal`. → `legacyRedirect` unit tests (Task 3) + `shell_check.py` (Task 5).
2. **Opening a deep link directly or reloading** `/anime/settings` must load the page (not a 404, not a blank page with data 404s): needs absolute `base: "/"` + data under `/data/anime/` + Worker `not_found_handling = "single-page-application"`. → `shell_check.py` reloads a deep link and checks cards appear (Task 5).
3. **Unknown addresses** (`/anime/nope`, `/foo`) show Anime's For you, never a blank page. → `parseRoute` tests + `pageFromPath` fallback (Tasks 3–4).
4. **Saved ratings survive the move**: a rating saved under `anime-scout.ratings` before load shows on My list after load. → `together_check.py` already stores ratings this way; it must pass at the new URL (Task 4).
5. **In-site links don't reload the page** (a reload re-downloads ~MBs of anime data): clicking sidebar links changes the page without a full load. → `shell_check.py` sets `window.__noReload = 1`, clicks 3 links, asserts it's still there (Task 5).

---

### Task 1: New repo with Anime Scout's site copied in, still working the old way

**Files:**
- Create (by copying from `C:\Users\PC_User\Projects\anime-scout`, without `node_modules`, `dist`, `*.tsbuildinfo`, `.dev.vars`):
  - `web/index.html`, `web/package.json`, `web/package-lock.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/public/favicon.svg`
  - `web/src/main.tsx` (stays at `web/src/`), everything else in `web/src/*` → `web/src/anime/*` (App.tsx, components/, lib/, pages/, state/, texts.ts, styles.css)
  - `web/public/data/*` → `web/public/data/anime/*`
  - `worker/` (package.json, package-lock.json, tsconfig.json, wrangler.toml, src/, test/)
  - `tests/browser/*.py` + `README.txt` → `tests/browser/`
  - `.gitignore` (copy Anime Scout's, drop the Python/data/flowlog lines that don't apply)
  - `docs/superpowers/specs/2026-11-15-merge-design.md` (copy of the spec), `docs/superpowers/plans/2026-11-15-step1-anime-moves-in.md` (copy of this plan)
- Modify: `web/src/main.tsx` (imports from `./anime/...`), `web/vite.config.ts` (port 5185, comment), `web/src/anime/lib/data.ts:65` (`DATA` → `${import.meta.env.BASE_URL}data/anime/`), `tests/browser/*.py` (`URL = "http://localhost:5185/"`), `README.md` (what this repo is, how to run web + worker, the no-deploy warning)

**Interfaces:**
- Produces: the site served at `http://localhost:5185/` exactly as Anime Scout is today (hash pages `#/liked` etc.); data at `web/public/data/anime/`.

- [ ] **Step 1:** `git clone https://github.com/TR2000ID/AnythingScout_site.git C:\Users\PC_User\Projects\anything-scout` and copy the files listed above.
- [ ] **Step 2:** Install: `npm ci` in `web/` and in `worker/`. Expected: no errors.
- [ ] **Step 3:** Run the moved unit tests. `npm test` in `web/` → the audit tests PASS; `npm test` in `worker/` → `watch.test.ts` PASS; `npm run build` in `web/` → no type errors.
- [ ] **Step 4:** Start `npm run dev` in `worker/` and in `web/`, then run each browser check with Anime Scout's venv:
  `C:\Users\PC_User\Projects\anime-scout\.venv\Scripts\python.exe tests\browser\site_check.py <scratch folder>` (and `import_check`, `together_check`, `watch_check`, `calendar_check`). Expected: same results as on 5182 today (`watch_check` reports `no_key` until TMDB_KEY exists — that's today's behaviour too).
- [ ] **Step 5:** Commit "Anime Scout's site moved in (no changes yet)" and push.

### Task 2: Anime Scout's export writes into the new repo

**Files (in the `anime-scout` repo):**
- Modify: `export_web.py:30` — `OUT = Path(os.environ.get("ANYTHING_SCOUT_DATA", "../anything-scout/web/public/data/anime"))` (+ `import os`), docstring line 1 mentions the new place.
- Modify: `tests/test_core.py` — `test_site_files_fit_together_after_export_web` uses `from export_web import OUT` instead of its own `Path("web/public/data")`; assertions unchanged.

**Interfaces:**
- Consumes: Task 1's `web/public/data/anime/`.
- Produces: `export_web.OUT` (a `Path`), the one place that says where Anime's site data goes.

- [ ] **Step 1:** Change the test to import `OUT`; run `pytest tests/test_core.py -k site_files -v` in `anime-scout`. Expected: PASS (still the old folder). Then `ANYTHING_SCOUT_DATA=C:\empty pytest … -k site_files` → SKIPPED (proves the test follows `OUT`; not a new test, so no red step).
- [ ] **Step 2:** Make the `OUT` change; run `python -I export_web.py` (needs `data/processed`, which exists on this PC). Expected: prints `-> ..\anything-scout\web\public\data\anime (… MB)`.
- [ ] **Step 3:** `pytest -q` in `anime-scout` → all PASS. `git -C ../anything-scout status` → data files unchanged or only the expected regenerated ones (same sizes as meta.json says).
- [ ] **Step 4:** Commit in `anime-scout` ("export_web writes into anything-scout") and push; if the data changed, commit + push it in `anything-scout` too.

### Task 3: Routes as plain functions (tested)

**Files:**
- Create: `web/src/shell/route.ts`
- Test: `web/src/shell/route.test.ts`

**Interfaces:**
- Produces:
  - `type Section = "games" | "anime" | "manga"`
  - `interface Route { section: Section; page: string }` — `page` is the rest of the path without slashes, `""` for the section's home
  - `parseRoute(pathname: string): Route | null`
  - `legacyRedirect(pathname: string, hash: string, search: string): string | null`
  - `homeFor(saved: string | null, ready: Section[], hasAnimeRatings: boolean): Section`
  - `SECTION_KEY = "anything-scout.section"`, `SECTIONS: Section[] = ["games", "anime", "manga"]`

- [ ] **Step 1: Write the failing tests**

```ts
describe("parseRoute", () => {
  it("reads section and page", () => expect(parseRoute("/anime/liked")).toEqual({ section: "anime", page: "liked" }));
  it("section home with or without slash", () => {
    expect(parseRoute("/anime")).toEqual({ section: "anime", page: "" });
    expect(parseRoute("/anime/")).toEqual({ section: "anime", page: "" });
  });
  it("root and unknown sections are not routes", () => {
    expect(parseRoute("/")).toBeNull();
    expect(parseRoute("/foo/bar")).toBeNull();
  });
});
describe("legacyRedirect", () => {
  it("old Anime Scout hash links go to /anime/", () => {
    expect(legacyRedirect("/", "#/liked", "")).toBe("/anime/liked");
    expect(legacyRedirect("/", "#/", "")).toBe("/anime/");
    expect(legacyRedirect("/", "#/together", "?mine")).toBe("/anime/together?mine");
  });
  it("new-style addresses are left alone", () => {
    expect(legacyRedirect("/anime/liked", "", "")).toBeNull();
    expect(legacyRedirect("/", "", "")).toBeNull();
  });
});
describe("homeFor", () => {
  it("last section used wins when it's ready", () => expect(homeFor("anime", ["games", "anime"], false)).toBe("anime"));
  it("first visit: Games, unless they already have Anime ratings", () => {
    expect(homeFor(null, ["games", "anime"], false)).toBe("games");
    expect(homeFor(null, ["games", "anime"], true)).toBe("anime");
  });
  it("a saved section that isn't ready yet falls back", () => expect(homeFor("games", ["anime"], false)).toBe("anime"));
  it("junk in storage falls back", () => expect(homeFor("{oops", ["anime"], false)).toBe("anime"));
});
```

- [ ] **Step 2:** `npm test` in `web/` → FAIL (`route.ts` doesn't exist).
- [ ] **Step 3:** Implement the five exports in `web/src/shell/route.ts`. `homeFor` order: saved (if in `ready`) → `"anime"` if `hasAnimeRatings` and ready → first of `SECTIONS` that's in `ready`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit "Routes: /section/page, old #/ links, home section" and push.

### Task 4: Anime runs on `/anime/...` addresses

**Files:**
- Modify: `web/src/shell/route.ts` — add the browser side: `routeStore` (via `anime/state/createStore`'s `createStore`), `useRoute(): Route`, `navigate(href: string): void` (pushState + update store + `scrollTo(0,0)`), `installLinks(): void` (one `click` listener on `document`: left click, no modifier keys, `<a>` with same-origin `href` and no `target`/`download` → `preventDefault()` + `navigate`), `popstate` updates the store.
- Modify: `web/src/anime/state/ui.ts` — `pageFromHash()` → `pageFromPath(page: string): Page` (unknown → `"for-you"`); `pageStore` follows `routeStore` when `section === "anime"`; `hrefOf(page)` → `"/anime/"` for `for-you`, else `` `/anime/${page}` ``; `showPicks()` uses `navigate(hrefOf("for-you"))`. Remove the `hashchange` listener.
- Modify: `web/src/main.tsx` — before rendering: if `legacyRedirect(location.pathname, location.hash, location.search)` gives an address, `history.replaceState` to it; call `installLinks()`.
- Modify: `web/vite.config.ts` — `base: "/"` (nested paths need absolute links).
- Modify: `worker/wrangler.toml` — under `[assets]`: `not_found_handling = "single-page-application"`; comment why.
- Modify: `tests/browser/*.py` — `URL = "http://localhost:5185/anime/"`; every `URL + "#/x"` → `URL + "x"`, `URL + "#/"` → `URL`, `"?cal#/liked"` → `"liked?cal"`, `"?slow#/liked"` → `"liked?slow"`, `"?mine#/together"` → `"together?mine"`.

**Interfaces:**
- Consumes: Task 3's `parseRoute`, `legacyRedirect`, `Route`.
- Produces: `useRoute()`, `navigate(href)`, `installLinks()`; `hrefOf(page)` now returns `/anime/...`.

- [ ] **Step 1:** Run `site_check.py` (already changed to the new URLs) against the dev server. Expected: FAIL — `/anime/settings` shows For you (pages still read the hash).
- [ ] **Step 2:** Make the changes above.
- [ ] **Step 3:** `npm test` + `npm run build` in `web/` → PASS. All 5 browser checks → same results as Task 1 Step 4.
- [ ] **Step 4:** `npm run build` in `web/`, then `npx wrangler dev --port 8789` in `worker/` (serves `web/dist` like production) and open `http://localhost:8789/anime/settings` directly → Settings page with data (not a 404).
- [ ] **Step 5:** Commit "Anime on /anime/ addresses, old #/ links redirect" and push.

### Task 5: Service bar, Soon pages, home section, phone layout

**Files:**
- Create: `web/src/shell/texts.ts` — `SITE_NAME = "Anything Scout"`; `SHELL_TEXTS: Record<"en" | "ja", { games; anime; manga; soon; soonGames; soonManga }>` with: en `Games / Anime / Manga & Comics / Soon`, ja `ゲーム / アニメ / マンガ・コミック / 準備中`; `soonGames` en "Games is moving in next: Steam, PlayStation and Xbox picks from Game Scout, with prices and sales." ja "ゲームは次に引っ越してきます：Game ScoutのSteam・PlayStation・Xboxのおすすめ、価格とセール。"; `soonManga` = the Manga text from the prototype (en/ja).
- Create: `web/src/shell/ServiceBar.tsx` — `ServiceBar()`: site name on the left (links to `/`), three tabs in spec order linking to `/games/`, `/anime/`, `/manga/`, current one underlined in the accent, "Soon" pill on not-ready ones (hidden under 820px), language from `useSettings().lang` (Anime's setting, until step 3 makes settings shared).
- Create: `web/src/shell/Soon.tsx` — `Soon({ section }: { section: "games" | "manga" })`: centered title + text from `SHELL_TEXTS`.
- Create: `web/src/shell/Shell.tsx` — `Shell()`: `<ServiceBar/>` then by `useRoute()`: `anime` → Anime's `<App/>`; `games`/`manga` → `<Soon/>`; `null` route → `navigate` (replace) to `homeFor(localStorage[SECTION_KEY], READY, ratings exist)` with `READY: Section[] = ["anime"]` (step 2 adds `"games"`). Saves the current section to `SECTION_KEY` (try/catch around storage).
- Create: `web/src/shell/shell.css` — bar height `--service-bar: 52px`, sticky top; Anime's `.sidebar` (`styles.css:89-92`) and `.topbar` (`:103`) get `top: var(--service-bar)` and the sidebar `height: calc(100vh - var(--service-bar))`; under 820px the tabs scroll sideways inside the bar (no page-wide sideways scroll), as in the prototype.
- Modify: `web/src/main.tsx` — render `<Shell/>` instead of `<App/>`; import `shell/shell.css` after `anime/styles.css`.
- Modify: `web/index.html` — `<title>` = `Anything Scout` (placeholder, same as `SITE_NAME`), description mentions games, anime, manga.
- Create: `tests/browser/shell_check.py` — at 1366×900 and 390×844, prints PASS/FAIL lines like the other checks.

**Interfaces:**
- Consumes: `parseRoute`, `homeFor`, `SECTION_KEY`, `useRoute`, `navigate` (Tasks 3–4); Anime's `App`, `useSettings`, `ratingsStore`.
- Produces: `Shell`, `ServiceBar`, `Soon`, `SHELL_TEXTS`, `SITE_NAME`, `READY`.

- [ ] **Step 1: Write the failing browser check** `shell_check.py` asserting:
  - `/` with empty storage → lands on `/anime/` (step 1: Anime is the only ready section), service bar shows `Games`, `Anime`, `Manga & Comics` in that order;
  - clicking `Games` → `/games/` shows the Soon text; clicking `Anime` → back with cards;
  - `/#/liked` → URL becomes `/anime/liked`;
  - after visiting `/manga/`, opening `/` → lands on `/anime/` (Manga isn't ready), after visiting `/anime/liked` then `/` → `/anime/`;
  - `window.__noReload = 1`, click Liked, Settings, For you in the sidebar → `window.__noReload === 1` still;
  - reload on `/anime/settings` → Settings heading visible and at least 1 card appears after going to For you;
  - 390px wide: `document.documentElement.scrollWidth <= innerWidth` on `/anime/` and `/games/`; ☰ opens the drawer;
  - switch Anime's language to 日本語 in Settings → tabs read `ゲーム`, `アニメ`, `マンガ・コミック`.
- [ ] **Step 2:** Run it → FAIL (no service bar).
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** `shell_check.py` → all PASS; the 5 Anime browser checks → still PASS; `npm test` + `npm run build` → PASS. Look at the screenshots: nothing in Anime moved except being 52px lower.
- [ ] **Step 5:** Commit "Service bar: Games · Anime · Manga & Comics, Soon pages, home section" and push.
- [ ] **Step 6:** Update the vault: tick step 1 in `(C) Combined Site — Merge Design.md` ("Step 1 done", date, commit), note that Games lands first once step 2 adds it to `READY`.

---

## Self-review notes (Claude, 2026-11-15)

- Spec step 1 = "site runs locally with only Anime under the service switch, export_web writes into the new repo, browser checks pass" → Tasks 1, 2, 5 (+4 for the `/anime/` addresses the spec asks for). Go-live, Games, shared parts: steps 2–4, not here.
- "First visit: Games" can't happen until Games exists; `homeFor` + `READY` make it automatic in step 2.
- Shared language setting (spec) stays Anime's setting in step 1; the shell only reads it. Step 3 makes it site-wide.

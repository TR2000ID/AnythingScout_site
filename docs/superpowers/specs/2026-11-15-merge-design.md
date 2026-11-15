# Combined Site — Merge Design (project 1 of 4)

> Written by Claude on 2026-11-15 from the brainstorm with you. Status: **approved 2026-11-15** (you sent the repo link to start building).
> Name of the site: **not decided yet** (you'll pick it later). "the site" below = the combined site.

## Why

You and your friends should have **one place to go** for recommendations, the way DMM puts 動画, 電子書籍 and GAMES under one account and one top bar. Today Anime Scout is live on its own address and Game Scout only runs on your PC, with separate lists and separate code that started as copies of each other and is slowly drifting apart.

Cross-section recommendations ("you liked this anime, so try this game") were looked into and dropped for now: no free dataset has the same people rating anime and games, so it would only be tag guessing. Parked, not planned.

Mockups (open in a browser): `03 Projects/(C) Combined Site — Mockups/`: 1 site layout + Play with a friend + cross-play (v4), 2 Play together with saved groups (v6, clickable), 3 Language settings + quick setup (v8, clickable), **4 full clickable site prototype (v9)** with real covers, titles, prices and descriptions.

## The projects (this document = #1)

1. **Merge the sites** — this document.
1b. **Language settings + quick setup** (your ask 2026-11-15, mockup v7; Claude's call: its own small project right after the merge, so the merge stays a pure move). Three separate choices in Settings: **Menus & text** (English / 日本語), **Titles** (*Original language* = Japanese works in Japanese, others in English / Always English / Always Japanese when there is one / Romaji for anime; the other name always shown small, search finds both), **Descriptions** default in Settings (*Original language* = Japanese works in Japanese / same as menus / English / 日本語; if only one language exists it's shown and marked) **plus an EN / 日本語 switch on every description** to flip it on the spot (your ask 2026-11-15, mockup v8; crossed out when that language doesn't exist; Claude's call: the flip is for that moment only, the Settings default is what sticks). Or answer **3 quick questions on a first visit** with real examples (進撃の巨人 / Attack on Titan / Shingeki no Kyojin), redo-able from Settings. Data checked 2026-11-15: anime has English, romaji, Japanese titles + country of origin + English descriptions only (AniList); games have English + Japanese store names, Steam descriptions in both languages, consoles English only (IGDB); a game's origin country needs IGDB (company country), until then a guess (Japanese store name + Japanese voice acting). Anime tags need a one-time Japanese list (~400). Neither site shows descriptions today: new.
1c. **Live Steam prices** (your ask 2026-11-15: "realtime steam sales"; Claude's call: right after the merge, it needs the merged site's Worker). Checked 2026-11-15: Steam's store API answers several games per request (`appdetails?appids=a,b,c&filters=price_overview&cc=jp`), but browsers can't call it directly (no CORS), so the Worker asks. (1) Prices on screen: the page asks `/api/prices?ids=…`, the Worker asks Steam in one batch, each answer cached ≤1 hour (Cloudflare cache, no write limits); cards say "Live price · checked 12 min ago". (2) Hourly Cloudflare cron (free) re-checks a quarter of all ~18,400 games → full Sales list fresh every ~4 hours, saved as one blob (KV: ~24 writes/day, well inside free). (3) "Sale ends in 2 days" where an end date is known. (4) Steam unreachable → fall back to the 04:00 prices, labeled. Risk: undocumented API, could be throttled or changed. Parked idea: IsThereAnyDeal free API for "lowest price ever" + other stores.
2. **Username accounts on Cloudflare D1 + profile pictures** — one list that follows you to any device. Username only, no password (your call). Pictures shrunk to a small square (~10 KB) and kept in D1 (R2 needs a card on file even when free). Risk noted: with username-only, anyone could change your picture; the "add a key later" upgrade is the fix if it ever happens. Own design later.
2b. **Friends** — friend groups; see what your friends **enjoyed** (Loved + Liked only: Okay, Disliked and Hidden stay private, your call 2026-11-15); Watch together uses the group's lists automatically; **Play together** (a page inside Games): **click one or more friends on/off ("who's playing") and the picks update for exactly that group** (your ask 2026-11-15; replaces a separate Group / One friend switch; mockup v5). Each pick shows "fits all of you" %, each person's score, and whether everyone can join (same platform, cross-play, or not); games left out are listed with the reason ("Sota wouldn't enjoy it", "no cross-play between your platforms"). **Saved friend groups** (your ask 2026-11-15, mockup v6): name a group ("Friday night", "Xbox crew"), click it to load those friends, × to delete; picking friends by hand that don't match a saved group offers "Save these as a group". Groups are yours (saved with your account), not shared with the friends in them (Claude's call; shared groups could come later). Earlier idea: for a whole group **or one friend** (your ask 2026-11-15: "recommended to play with this friend"): a list of friends, each with how many games you two could play together and the best one; pick a friend → multiplayer games that fit you both, with each person's score; on For you, a multiplayer pick a friend would also enjoy gets a "Play with Ken · online co-op" line. **Cross-play** shown on each pick (your ask 2026-11-15), using each friend's "Plays on" platforms from their profile (Claude's proposal): "Cross-play: Steam ↔ PS5 · you can play together" / "No cross-play". Source checked 2026-11-15: **PCGamingWiki** has `crossplay` (true/limited/false), `crossplay platforms` and notes (e.g. Deep Rock Galactic = limited, Xbox only, Microsoft Store version), plus online/local player counts; free, CC BY-NC-SA (credit it); its bulk query API is closed to us, but the per-page read API works, so fetch politely and cache. Steam's official "Cross-Platform Multiplayer" store category = yes/no fallback without platforms. IGDB has no cross-play field. All of it = group picks filtered to multiplayer (Steam tags now: Co-op, Online Co-Op, Local Multiplayer, PvP, MMO; PlayStation/Xbox once IGDB keys exist, which have player counts). Claude's call: friends' lists also carry "seen it" for everything they rated, without the rating, so group picks don't suggest something a friend already saw (as Watch together does today). Own design later.
3. **Methods + accuracy check** — stricter testing (add NDCG, an item-similarity baseline, ± ranges, check for leaks), then each homemade rule vs a published alternative; **the test results decide** which stays. Python work in the data repos. Own design later.
4. **Trust display** — "How well it works" on About (real test results vs most-popular) + outside scores on cards (MAL score, Steam review %). Needs #3's numbers. Own design later.

Manga is a later section of its own.

**TV & Movies** is a later section of its own too (your call 2026-11-15: "TV shows + movies"). Live-action dramas and comedies (J/K/Western), movies, and non-anime cartoons (moved here from Anime Scout's v1.2 plan). Data checked 2026-11-15: catalog, Japanese titles, posters, keywords and Japan where-to-watch from the **TMDB API** (free key; the same key Anime's Japan where-to-watch needs). TV series get *More like these* + *TMDB recommends* (labeled, "not tested" on About: no free per-person TV ratings exist, MyDramaList only via scraping, against its terms). Movies also get real *Fans also liked* from MovieLens 32M / Letterboxd (~11M), both stop ~2023. See `Anime Scout/01 Build Phases/(C) Research — Cartoon Data, Old + New — Walkthrough.md`. Needs its own design (top-bar position, name in Japanese, etc.).

## Goals (project 1)

- One address, one site, with a **service switch** always visible at the top: **Games · Anime · Manga & Comics (Soon)**, in that order (your call, 2026-11-15).
- Each section keeps **all its features**: Anime (Fans also liked / More like these, import, Watch together, Where to watch, calendar, hidden gems) and Games (platform switch, prices, Sales page, On sale filter, Steam/PlayStation/Xbox, Switch "Soon").
- **One look**, one set of shared parts (cards, sidebar, rating menu, dialogs, toasts, styles) instead of two copies.
- **Nobody loses ratings**: friends' Anime ratings saved in their browsers, and your own Game Scout ratings.
- Game Scout goes **live** for the first time, as the Games section.

## Non-goals (project 1)

- No accounts yet (project 2). No username shown yet: the spot top right stays empty until accounts exist.
- No changes to how picks are worked out (project 3).
- No new trust display (project 4).
- No Manga & Comics section beyond a "Soon" tab.
- No cross-section recommendations.
- No site name / new address yet.

## Anti-goals (this would be a failure even if it works)

- **A big-bang rewrite that stalls.** Your own notes say merging codebases from scratch means "months + overwhelm + stall". Every step must end with a site that works.
- **Losing anyone's saved ratings.**
- **Anything that costs money.**
- **Looking AI-made**: no emoji icons, no loud colors; neutral + one accent, few visible controls (same as both sites today).

## Constraints

- Free: Cloudflare Workers free plan, same account as your other sites (`*.nomikai-scout-worker.workers.dev`). Data is ~29 MB for Games + Anime's data; the largest file is 4.4 MB (limit 25 MB per file).
- The data/Python work **stays in its own repos** (`anime-scout`, `game-scout`). Only the website moves.
- Existing tests keep passing: Anime's vitest tests and its 5 browser check scripts (`tests/browser/`, 44 checks), Game Scout's pytest. Browser checks get pointed at the new site.
- Commit and push at every working step (GitHub, private).
- Browsers keep saved data **per address**. Anything saved at the Anime Scout address only exists there.

## Approaches considered

| Approach | Trade-off | Picked? |
|---|---|---|
| **New site repo** with `anime/` and `games/` folders, shared parts kept once, both data repos export into it, one Worker | Biggest first step, but ends with one clean codebase | **Yes** (you agreed 2026-11-15) |
| Keep two sites, add a shared top bar linking them | Least work, but switching reloads a different site, the code keeps drifting, and accounts get awkward across two addresses | No |
| Grow Anime Scout's site into the hub | Fast, but Games would live inside the Anime repo and Game Scout's scripts would write into another project's folder | No |

## What you decided

- DMM-style: switch between services at the top; one username everywhere (once accounts exist).
- Sections, in this order: **Games, Anime, Manga & Comics (Soon).** Play together lives inside Games, not in the top bar.
- Sections do **not** feed each other's recommendations.
- New site repo; order merge → accounts → methods check → trust display.
- Hosting on Cloudflare; when Games is live, the daily 04:00 Steam update **deploys afterwards** so live prices refresh every morning.
- Accounts later = username only.

## Claude's calls (correct any of these)

- **Opening the site lands you in the last section you used** (first visit: Games, the first tab; but anyone who already has Anime ratings saved lands in Anime, so friends who come for anime aren't thrown into Games). No home page.
- **Addresses inside the site**: `/anime/...` and `/games/...` so a link opens the right section.
- **Where it goes live (step 4): the existing Anime Scout address** (`anime-scout.nomikai-scout-worker.workers.dev`). Reason: friends' Anime ratings are saved at that address, so keeping it means nobody loses anything. The real name + new address come after accounts (project 2), when lists live in D1 and an address change no longer loses data.
- **Saved-data names stay the same** (`anime-scout.ratings`, `game-scout.ratings`, and each site's settings) so old saves load as they are.
- **Your Game Scout ratings** exist only at `localhost:5181` on your PC. **After go-live, the live site is your real list** (your call, 2026-11-15); the PC dev site is for testing only. So the ratings are copied once into the dev site (step 2, to test with) and once into the live site at go-live (step 4). A one-time copy, not a permanent Export/Import feature; how is up to the builder, but they must arrive intact.
- **Shared settings**: language (follows the browser, as both do now) and title language (EN/JP) are set once for the whole site. Section-only settings stay in their section (Games: Steam store US $ / 日本 ¥; Anime: where-to-watch region, hidden gems).
- **Anime's small server** (`/api/watch`, Japan where-to-watch via TMDB) moves into the new repo's Worker unchanged.
- **Repo**: https://github.com/TR2000ID/AnythingScout_site.git (you created it 2026-11-15; it has GitHub's starter commit). Local folder `C:\Users\PC_User\Projects\anything-scout` (Claude's call, matching the other project folders). "Anything Scout" is the repo's name; the site's public name is still yours to pick.
- **Local dev port**: 5185 (5180–5182 are Steam Scout, Game Scout, Anime Scout; 5183 is Nomikai, 5184 Standup Notes).
- **What the 04:00 deploy sends live: only the last version you approved, with today's Steam data.** Unfinished work from projects 2–4 must never reach friends without your OK. So the live version is marked in git (a `live` tag, moved only when you OK a deploy), and the daily task rebuilds that marked version plus the fresh Steam files (which aren't in git, so the task copies them in).
- **"Update now" stays PC-only.** It refreshes your dev site; the live site gets new prices at 04:00. On a sale day you can also run one deploy command by hand (same approved version, fresh data). Game Scout's dormant GitHub `deploy.yml` is retired.
- **Old links keep working**: Anime Scout's existing `/#/...` addresses still open the right Anime page. The old `anime-scout/worker` deploy is retired so it can't overwrite the combined site; the new Worker keeps the name `anime-scout`, which keeps the live address and the TMDB secret. Your `(C) Open Game Scout Site.cmd` shortcut gets updated to open the new site.
- **Old sites**: Anime Scout's and Game Scout's `web/` folders stay in their repos until the new site is live and checked, then get removed with a note pointing to the new repo.

## Steps (each one ends with a working site)

1. **New repo + Anime moves in.** The site runs locally with only Anime, under the service switch (Games and Manga "Soon"). Anime's `export_web.py` writes into the new repo. Anime's browser checks pass against it.
2. **Games moves in.** Games' `import_steam.py`, `export_web.py` and `update_steam.py` write into the new repo; the "Update now" button still works in dev; the 04:00 task points at the new repo. Your Game Scout ratings come across.
3. **Shared parts combined.** The two copies of cards, sidebar, rating menu, dialogs, toasts, stores and styles become one. Tests still pass; nothing looks different except where the two had drifted (the builder lists those for you to pick).
4. **Goes live** on the Anime Scout address (needs your OK first: it's the live site). The 04:00 task gains "deploy after update". Browser checks run against the live site.

## Left to the builder

- Folder layout inside the new repo, how shared parts are split from section parts, and how the data repos find the new repo's data folder.
- How your Game Scout ratings get carried over (must be intact).
- How the service switch looks on phones (both sites already have a phone layout: search in a top bar, choices in the ☰ drawer).
- Where the two copies had drifted, list the differences for you to choose; don't silently pick.

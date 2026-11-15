# Combined Site — Accounts Design (project 2 of the combined site)

> Written by Claude on 2026-11-15 from the brainstorm with you. Status: **approved 2026-11-15** ("Looks good").
> Builds on `(C) Combined Site — Merge Design.md` (project 2 there: "Username accounts on Cloudflare D1 + profile pictures").

## Why

You want an account so **your preferences are saved securely on the website**, not only in one browser: sign in on your phone or another PC and get the same lists and settings. Today everything lives in the browser's storage at one address. Clear the browser, or switch from Firefox to your phone, and it's gone or missing.

## What you decided

- **Username only for now, no password** (2026-11-15: "username for now"). You were told the catch: anyone who types your username can see and change your list. Build it so a password can be added later as one new column, with no data moved and nobody signed out.
- **Encrypted**: in transit (HTTPS, already true on the live site) and at rest (Cloudflare encrypts D1 on disk). Neither stops someone who knows your username; that is what the later password is for.
- **Saving method B** (2026-11-15: "B is good"): each rating is saved on its own and merged by its date, so phone and PC edits combine and the newer one wins on the same item. Settings and the Watch together list are saved as whole blocks, where the newer block wins. Rating offline still works; it syncs when you're back online.
- **Cloudflare D1**, same Cloudflare account as your other sites, free plan (from the merge design).
- **Profile pictures** come with accounts: a small square kept in D1, not R2 (from the merge design).

## Goals

- **Create an account / sign in** with a username, on any device, from the top bar.
- **Five things follow you**: Anime ratings, Anime settings, Anime's Watch together friends, Games ratings, Games settings. Hidden items count as ratings and follow you too.
- **Nothing gets lost**: not when two devices edit at once, not when you're offline, not when you first sign in on a browser that already has ratings (your 83 Games ratings on the live site go into your account).
- **Un-rating syncs too**: remove a rating on the phone and it disappears on the PC.
- **Profile picture**: pick an image, it's shrunk in the browser to a small square, shown top right. No picture = a plain circle with your first letter.
- **Signing in is optional.** Friends who never make an account keep using the site exactly as today.

## Non-goals (this project)

- No password, PIN or recovery code (later, as one added column).
- No Friends features (project 2b): no friend lists, no seeing other people's ratings, no searching for usernames.
- No email, no real names, no sign in with Google.
- No delete-account or rename button (see "Settled after the builder check").
- No live push between devices: a device picks up changes when it loads, comes back into focus, or after a change of its own. It doesn't update second-by-second.
- No change to how picks are worked out, and no shared-parts merge (that's merge step 3, separate).

## Anti-goals (a failure even if it works)

- **Losing a rating.** Any sync path that can silently drop or overwrite a newer rating is a bug.
- **Your PC test site writing into your real account.** The dev site uses its own local test database (wrangler's local D1), never the live one.
- **Costing money.** Stay inside D1's free limits (5 GB, 5 million rows read and 100,000 rows written per day; a few friends use a tiny fraction).
- **Looking AI-made**: no emoji, no new colors; the account spot uses the existing neutral + accent look.
- **Unfinished work reaching friends.** It goes live only with your OK (`deploy:golive`, then move the `live` tag). The 04:00 daily deploy keeps shipping only the `live` tag.

## Approaches considered (saving)

| Approach | Trade-off | Picked? |
|---|---|---|
| A. Each list saved as one block, newest block wins | Simplest, but rating game X on the phone and game Y on the PC before they sync loses one of the two | No |
| **B. Each rating saved on its own, merged by its date; settings + Watch together list as whole blocks** | A little more code; the only one that can't silently lose a rating. Works offline | **Yes** (your pick) |
| C. Everything only on the server | Rewrites both sections' saving, and the site stops working offline | No |

## How it behaves

### The top bar (top right, the spot the merge design kept empty)

```
 Anything Scout    Games   Anime   Manga & Comics Soon                 Sign in
 Anything Scout    Games   Anime   Manga & Comics Soon            (K)  ken  v
```

- Signed out: a quiet **Sign in** text button.
- Signed in: picture (or first-letter circle) + username. Clicking opens a small menu: **Change picture**, **Remove picture**, **Sign out**, and a one-line "Synced 2 min ago" (or "Offline: changes will sync later").
- Phones: the same spot, picture only.

### Sign in / create account (one dialog, two tabs)

- **Sign in**: type your username. Unknown name: "No account with that name."
- **Create account**: type a new username. Taken: "That name is taken."
- A plain line under the box, always shown: *"Anyone who knows your username can open this account. Don't use your real name or anything private."*
- Usernames (Claude's call): 2–20 characters, letters in any language (so Japanese names work), digits, `_` and `-`.
- **Capitals count** (your call, 2026-11-15): `Ken` and `ken` are two different accounts, and signing in needs the capitals typed exactly as at creation. Full-width and half-width forms of the same character are still treated as one (Unicode NFKC, no lowercasing), so `Ｋｅｎ` typed on a Japanese keyboard opens `Ken`.

### First sign-in on a browser that already has ratings (Claude's call)

- **Account empty** (a new account): everything this browser has goes into the account. This is how your 83 Games ratings get in.
- **Account and browser both have things**: ask once: *"This browser has 12 ratings your account doesn't. Add them to your account? / Leave them out."* Add = merge (newer wins per item). Leave out = this browser switches to the account's lists; its own lists are set aside, not deleted (they come back on sign-out). This protects you from signing in on a friend's computer and pouring their ratings into your account.
- Settings: the account's settings win when the account has any; otherwise this browser's go up.

### Sign out (Claude's call)

- The browser goes back to what it had before you signed in on it (empty, or the lists that were set aside). Your account keeps everything. So signing out on a friend's computer leaves nothing of yours there.

### The merge rule (method B)

- Every rating row already has a date (`at`, set when you rate). Per item, **the newer `at` wins**.
- **Removing a rating is a change too**: it's saved as "removed at <time>" so the removal wins over an older rating on another device. "Clear all ratings" removes every one this way.
- Settings and the Watch together list: the whole block with the newer date wins.
- Same date on both sides: the account's copy wins.
- Dates come from each device's clock (Claude's call; a device with a badly wrong clock could win or lose wrongly; acceptable for a few friends).

### When it syncs

- On page load, a few seconds after any change you make, when the tab comes back into focus, and when the browser goes back online.
- Changes made offline wait in the browser and go up next time.
- Another tab on the same browser already follows changes today (the `storage` event); that keeps working.

### Profile picture

- Choose an image file → the browser crops it to a centered square and shrinks it to 128×128 (WebP or JPEG, roughly 10 KB, hard limit 50 KB on the server) → saved in D1.
- Anyone who knows your username could change it (the known username-only risk; the later password fixes it).

### Safety net

- **Guessing**: the server slows down an address that tries many usernames that don't exist (Claude's call; the exact limit is the builder's).
- **Vandalism or a bad sync**: D1 keeps a free 7-day restore point history (D1 Time Travel), so the whole database can be rolled back to a moment in the last week. A how-to goes in the repo README.
- **The live site's old saved data stays** in each browser exactly as today; accounts read it, they don't rename or move it (`anime-scout.ratings`, `game-scout.ratings`, etc.).

## Constraints

- Site repo `C:\Users\PC_User\Projects\anything-scout`, Worker `anime-scout` (same live address). The server code goes in `worker/src/`, next to `/api/watch`. D1 set up like Nomikai and Standup Notes (`[[d1_databases]]`, binding `DB`, `migrations/`).
- Server addresses under `/api/account/...`. No CORS headers (same address only), like `/api/watch`.
- Both sections' saving goes through their own `state/createStore.ts` + `ratings.ts` / `settings.ts`, and Anime's Watch together list through `pages/Together.tsx` (`anime-scout.friends`). The sync code is shared (in `shell/`), used by both sections, so merge step 3 doesn't have to undo it.
- Signed-in state survives reloads: after sign-in, the server gives the browser a random session token, kept in browser storage; every `/api/account` call needs it. (With username-only, the token doesn't stop a guesser, but it's what a password will later protect, so nothing changes shape then.)
- Leave room for the password: the users table gets an empty `password_hash` column (or equivalent) now.
- Existing tests keep passing (web vitest, worker tests, tools pytest, browser checks: shell, games, carry, site, import, together, watch, calendar). New browser check for accounts, run against the PC site with two separate browser profiles playing "phone" and "PC".
- Going live needs your OK: migrations applied to the live D1 (`wrangler d1 migrations apply --remote`) + `deploy:golive` + move the `live` tag. `tools/deploy_live.py` needs no change (it deploys the tag; the database is separate from the files).
- Free only. If anything would need a card on file, stop and ask.

## Settled after the builder check

- **Which site is your real one:** the live address (your call in the merge design: "after go-live, the live site is your real list; the PC dev site is for testing only"). So on the PC you rate on the live address (in Firefox), and that's what syncs with your phone. The PC dev site (localhost:5185, Update now) keeps its own local test database on purpose. Your 83 Games ratings go into your account from the live site's copy.
- **Order (Claude's call):** accounts come **before** merge step 3 (shared parts) and 1b (language settings), because you asked for them now and they don't depend on step 3. The server stores each settings / Watch together block as **plain JSON under its name** (`anime.settings`, `games.settings`, `anime.friends`), so step 3 / 1b can reshape them in the browser without a server change.
- **Games Phase 2 Part B (Claude's call):** ratings are saved under keys like `steam:730` now; Part B (when IGDB keys exist) may switch them to IGDB IDs. Not built now: the server treats item keys as plain text. Part B's own plan must include a one-time rename on the server, done together with the browser change, so a key change isn't seen as "removed everything, added new".

- **No delete or rename button for now** (your call, 2026-11-15). With username-only, anyone who knows the name could use it. If someone wants their account gone, you ask Claude and it's removed with one command (the README gets that command). A Delete button comes with passwords, when only the owner can press it.

## Left to the builder

- Table layout (beyond: users with a reserved password column, sessions, one row per rating with a "removed" state and its date, one row per settings/friends block with its date, picture bytes on the user).
- The exact sync protocol (what the browser sends and gets back, how it remembers what's not yet sent).
- How the sign-in dialog and account menu are built, as long as they match the existing look and the sketch above.
- The rate limit's numbers and where its counter lives (staying free).
- Wording of messages (English + Japanese, matching each section's existing texts).

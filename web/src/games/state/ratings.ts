// Your one list of ratings, for every platform, saved in this browser.
// It's saved as rows of { game, rating, at }: the same shape as the v1.1 accounts table
// (person, game, rating, date), so moving it into an account later is a straight copy.
import type { Tier } from "../lib/recommend";
import { createStore, loadSaved, save, useStore } from "./createStore";

export interface RatingRow {
  game: string; // "steam:730" (Phase 2: an IGDB ID)
  rating: Tier;
  at: string; // when you rated it
}

const KEY = "game-scout.ratings";

function load(): Map<string, RatingRow> {
  const saved = loadSaved<{ version: 1; rows: RatingRow[] }>(KEY);
  return new Map((saved?.rows ?? []).map((row) => [row.game, upgrade(row)]));
}

/** Older saved ratings: "Hated" was its own choice until 2026-11-06. It counted exactly like
 *  "Disliked" (0), so it was merged into it: a saved Hated loads as Disliked. */
function upgrade(row: RatingRow): RatingRow {
  return (row.rating as string) === "hated" ? { ...row, rating: "disliked" } : row;
}

export const ratingsStore = createStore(load());

ratingsStore.subscribe(() => save(KEY, { version: 1, rows: [...ratingsStore.get().values()] }));

// Another tab changed the ratings: pick them up here too
window.addEventListener("storage", (event) => {
  if (event.key === KEY) ratingsStore.set(load());
});

export function useRatings() {
  return useStore(ratingsStore);
}

/** Just game → tier, the shape the recommendation math wants */
export function tiersOf(rows: Map<string, RatingRow>): Map<string, Tier> {
  return new Map([...rows].map(([key, row]) => [key, row.rating]));
}

/** Set (or with null, remove) one game's rating. Returns what it was, for Undo. */
export function setRating(game: string, rating: Tier | null): RatingRow | undefined {
  const before = ratingsStore.get().get(game);
  ratingsStore.set((current) => {
    const next = new Map(current);
    if (rating) next.set(game, { game, rating, at: new Date().toISOString() });
    else next.delete(game);
    return next;
  });
  return before;
}

/** Put a rating back the way it was (Undo) */
export function restoreRating(game: string, before: RatingRow | undefined) {
  ratingsStore.set((current) => {
    const next = new Map(current);
    if (before) next.set(game, before);
    else next.delete(game);
    return next;
  });
}

export function clearRatings() {
  ratingsStore.set(new Map());
}

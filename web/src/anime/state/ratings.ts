// Your list of ratings, saved in this browser.
// Saved as rows of { show, rating, at }: the same shape an accounts table would have later
// (person, show, rating, date), so moving it into an account is a straight copy.
import type { Tier } from "../lib/recommend";
import { createStore, loadSaved, save, useStore } from "./createStore";

export interface RatingRow {
  show: string; // "mal:5114": the MyAnimeList ID, also what AniList and MyAnimeList imports give
  rating: Tier;
  at: string; // when you rated it
}

const KEY = "anime-scout.ratings";

const SAVED_TIERS: ReadonlySet<string> = new Set<Tier>(["loved", "liked", "okay", "disliked", "hidden"]);

/** A saved row we can trust (the browser's storage can hold anything: an old version, a hand edit). */
const isRow = (row: unknown): row is RatingRow =>
  typeof row === "object" && row !== null && typeof (row as RatingRow).show === "string" && SAVED_TIERS.has((row as RatingRow).rating);

function load(): Map<string, RatingRow> {
  const saved = loadSaved<{ version?: number; rows?: unknown }>(KEY);
  const rows = Array.isArray(saved?.rows) ? saved.rows.filter(isRow) : []; // a broken save starts empty, not a blank page
  return new Map(rows.map((row) => [row.show, row]));
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

/** Just show → tier, the shape the recommendation math wants */
export function tiersOf(rows: Map<string, RatingRow>): Map<string, Tier> {
  return new Map([...rows].map(([key, row]) => [key, row.rating]));
}

/** Set (or with null, remove) one show's rating. Returns what it was, for Undo. */
export function setRating(show: string, rating: Tier | null): RatingRow | undefined {
  const before = ratingsStore.get().get(show);
  ratingsStore.set((current) => {
    const next = new Map(current);
    if (rating) next.set(show, { show, rating, at: new Date().toISOString() });
    else next.delete(show);
    return next;
  });
  return before;
}

/** Many at once (a list import): one save, one redraw */
export function setRatings(rows: { show: string; rating: Tier }[]) {
  const at = new Date().toISOString();
  ratingsStore.set((current) => {
    const next = new Map(current);
    for (const { show, rating } of rows) next.set(show, { show, rating, at });
    return next;
  });
}

/** Put a rating back the way it was (Undo) */
export function restoreRating(show: string, before: RatingRow | undefined) {
  ratingsStore.set((current) => {
    const next = new Map(current);
    if (before) next.set(show, before);
    else next.delete(show);
    return next;
  });
}

export function clearRatings() {
  ratingsStore.set(new Map());
}

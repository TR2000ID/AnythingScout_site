// The five things an account carries, each seen through one small shape, so the sync code (shared by both
// sections) never needs to know how Anime or Games keep their lists:
//   ratings: Anime ratings, Games ratings                 → RatingSection (one row per item, with its date)
//   blocks:  Anime settings, Games settings, Watch together → BlockSection (one JSON text, saved whole)
// get() reads the copy saved in the browser, not just this tab's memory: another tab may have changed it a
// moment ago, and syncing an out-of-date copy would undo that change.
import * as animeRatings from "../../anime/state/ratings";
import * as animeSettings from "../../anime/state/settings";
import { friendsFrom, friendsStore, readSavedFriends } from "../../anime/state/friends";
import * as gameRatings from "../../games/state/ratings";
import * as gameSettings from "../../games/state/settings";
import type { BlockName, Section } from "./types";

export interface RatingValue {
  rating: string;
  at: string;
}

export interface RatingSection {
  section: Section;
  get(): Map<string, RatingValue>;
  /** Replace the whole list with these rows, keeping their dates (one save, one redraw) */
  replace(rows: Map<string, RatingValue>): void;
  subscribe(fn: () => void): () => void;
}

export interface BlockSection {
  name: BlockName;
  get(): string;
  /** Apply a saved block; a broken one is ignored */
  replace(value: string): void;
  subscribe(fn: () => void): () => void;
}

const animeRatingSection: RatingSection = {
  section: "anime",
  get: () => new Map([...animeRatings.readSavedRatings()].map(([k, r]) => [k, { rating: r.rating, at: r.at }])),
  replace: (rows) =>
    animeRatings.ratingsStore.set(
      new Map([...rows].map(([show, r]) => [show, { show, rating: r.rating as animeRatings.RatingRow["rating"], at: r.at }])),
    ),
  subscribe: (fn) => animeRatings.ratingsStore.subscribe(fn),
};

const gameRatingSection: RatingSection = {
  section: "games",
  get: () => new Map([...gameRatings.readSavedRatings()].map(([k, r]) => [k, { rating: r.rating, at: r.at }])),
  replace: (rows) =>
    gameRatings.ratingsStore.set(
      new Map([...rows].map(([game, r]) => [game, { game, rating: r.rating as gameRatings.RatingRow["rating"], at: r.at }])),
    ),
  subscribe: (fn) => gameRatings.ratingsStore.subscribe(fn),
};

function parse(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

const animeSettingsBlock: BlockSection = {
  name: "anime.settings",
  get: () => JSON.stringify(animeSettings.savedForm(animeSettings.readSavedSettings())),
  replace: (value) => {
    const p = parse(value);
    if (p.ok && p.value && typeof p.value === "object" && !Array.isArray(p.value)) animeSettings.settingsStore.set(animeSettings.settingsFrom(p.value));
  },
  subscribe: (fn) => animeSettings.settingsStore.subscribe(fn),
};

const gameSettingsBlock: BlockSection = {
  name: "games.settings",
  get: () => JSON.stringify(gameSettings.savedForm(gameSettings.readSavedSettings())),
  replace: (value) => {
    const p = parse(value);
    if (p.ok && p.value && typeof p.value === "object" && !Array.isArray(p.value)) gameSettings.settingsStore.set(gameSettings.settingsFrom(p.value));
  },
  subscribe: (fn) => gameSettings.settingsStore.subscribe(fn),
};

const friendsBlock: BlockSection = {
  name: "anime.friends",
  get: () => JSON.stringify(readSavedFriends()),
  replace: (value) => {
    const p = parse(value);
    if (p.ok && Array.isArray(p.value)) friendsStore.set(friendsFrom(p.value));
  },
  subscribe: (fn) => friendsStore.subscribe(fn),
};

export const RATING_SECTIONS: RatingSection[] = [animeRatingSection, gameRatingSection];
export const BLOCK_SECTIONS: BlockSection[] = [animeSettingsBlock, gameSettingsBlock, friendsBlock];

/** Everything this browser has, to set aside on sign-in ("Leave them out") and put back on sign-out */
export interface LocalSnapshot {
  ratings: Record<string, Record<string, RatingValue>>; // section → item → row
  blocks: Record<string, string>; // block name → its JSON text
}

export function snapshotLocal(ratings = RATING_SECTIONS, blocks = BLOCK_SECTIONS): LocalSnapshot {
  return {
    ratings: Object.fromEntries(ratings.map((r) => [r.section, Object.fromEntries(r.get())])),
    blocks: Object.fromEntries(blocks.map((b) => [b.name, b.get()])),
  };
}

export function restoreLocal(snap: LocalSnapshot, ratings = RATING_SECTIONS, blocks = BLOCK_SECTIONS) {
  for (const r of ratings) r.replace(new Map(Object.entries(snap.ratings[r.section] ?? {})));
  for (const b of blocks) b.replace(snap.blocks[b.name] ?? (b.name === "anime.friends" ? "[]" : "{}"));
}

/** Empty ratings, default settings, no friends (signing out on a browser that had nothing before) */
export function clearLocal(ratings = RATING_SECTIONS, blocks = BLOCK_SECTIONS) {
  for (const r of ratings) r.replace(new Map());
  for (const b of blocks) b.replace(b.name === "anime.friends" ? "[]" : "{}");
}

// The two modes, run in the browser on export_web.py's files (a few milliseconds, so picks update the
// moment you rate something). Same math as recommend.py.
//
//   fans: every show you liked "votes" for the shows its fans also liked (EASE links, build_links.py)
//   tags: your taste = the tags of the shows you liked; every show scored by how close it is (cosine)
//
// Hidden gems slider: every score is divided by (people who scored the show + 50) ^ gems. 0 = as
// measured, higher = less-known shows come up (the "mega-hit tax", chosen by you instead of fixed).
import type { Catalog, Show } from "./data";

export type Mode = "fans" | "tags";
export type Tier = "loved" | "liked" | "okay" | "disliked" | "hidden";
export const TIERS: Tier[] = ["loved", "liked", "okay", "disliked"];

// Same weights Game Scout tested on real players: loved counts double, okay a little (you watched it),
// disliked never comes back but doesn't push similar shows down (that made picks worse everywhere)
export const TIER_WEIGHT: Record<Tier, number> = { loved: 2, liked: 1, okay: 0.1, disliked: 0, hidden: 0 };

export interface Reason {
  because: Show; // the liked show that did the most to bring this one up
  pct: number | null; // fans: % of the fans of `because` who also liked this one
  tags: string[]; // tags: the shared tags doing the most work
}

export interface Pick {
  show: Show;
  match: number; // 0-0.99: 1 would be your best match in the whole catalog
}

export interface Picks {
  picks: Pick[]; // every match, best first
  liked: number; // loved + liked that went in
  rated: number; // every rating but hidden
  reasonFor: (show: Show) => Reason | null;
}

export interface Weighted {
  row: number;
  weight: number;
}

/** Your ratings → the shows that pull picks up, and the ones never to recommend back. */
export function split(catalog: Catalog, ratings: Map<string, Tier>) {
  const liked: Weighted[] = [];
  const rated = new Set<number>();
  let likes = 0;
  let counted = 0;
  for (const [key, tier] of ratings) {
    const show = catalog.byKey.get(key);
    if (!show) continue;
    rated.add(show.row);
    const weight = TIER_WEIGHT[tier];
    if (weight > 0) liked.push({ row: show.row, weight });
    if (tier === "loved" || tier === "liked") likes++;
    if (tier !== "hidden") counted++;
  }
  return { liked, likes, counted, rated };
}

export function recommend(
  catalog: Catalog,
  ratings: Map<string, Tier>,
  mode: Mode,
  allowed: (show: Show) => boolean,
  gems = 0,
): Picks {
  const { liked, likes, counted, rated } = split(catalog, ratings);
  const empty: Picks = { picks: [], liked: likes, rated: counted, reasonFor: () => null };
  if (!likes) return empty;
  const result = mode === "fans" ? byFans(catalog, liked) : byTags(catalog, liked);
  if (!result) return empty;
  return rank(catalog, result.scores, rated, allowed, gems, result.reasonFor, likes, counted);
}

/** Scores → match, 0-1: what you've rated and specials get 0, the hidden-gems tax is applied, and the
 *  best show you HAVEN'T rated is 1. For you and Watch together both use this, so a show's % is the same
 *  on both pages (your own liked show would otherwise be the "best" and pull every other % down). */
export function matches(catalog: Catalog, scores: Float64Array, rated: Set<number>, gems: number): Float64Array {
  let best = 1e-9;
  const final = new Float64Array(scores.length);
  for (let r = 0; r < scores.length; r++) {
    const show = catalog.shows[r];
    if (rated.has(r) || !(scores[r] > 0) || !show.recommend) continue;
    final[r] = gems ? scores[r] / Math.pow(show.popularity + 50, gems) : scores[r];
    if (final[r] > best) best = final[r];
  }
  for (let r = 0; r < final.length; r++) final[r] /= best;
  return final;
}

/** Scores → picks: never what you've rated, never a special, the gems tax, best first. */
export function rank(
  catalog: Catalog,
  scores: Float64Array,
  rated: Set<number>,
  allowed: (show: Show) => boolean,
  gems: number,
  reasonFor: Picks["reasonFor"],
  liked = 0,
  counted = 0,
): Picks {
  const final = matches(catalog, scores, rated, gems);
  const eligible = catalog.shows.filter((show, r) => final[r] > 0 && allowed(show)).map((show) => show.row);
  eligible.sort((a, b) => final[b] - final[a]);
  return {
    picks: eligible.map((r) => ({ show: catalog.shows[r], match: Math.min(final[r], 0.99) })),
    liked,
    rated: counted,
    reasonFor,
  };
}

// ---------- fans also liked ----------
export function byFans(catalog: Catalog, liked: Weighted[]) {
  const nb = catalog.neighbors;
  if (!nb) return null; // still loading
  const n = catalog.shows.length;
  const scores = new Float64Array(n);
  const bestVote = new Float64Array(n);
  const bestFrom = new Int32Array(n).fill(-1);
  const bestPct = new Uint8Array(n);
  for (const { row, weight } of liked) {
    if (row >= nb.rows) continue; // newer than the scores: no links
    for (let k = row * nb.perShow; k < (row + 1) * nb.perShow; k++) {
      const j = nb.idx[k];
      const vote = weight * nb.sim[k];
      scores[j] += vote;
      if (vote > bestVote[j]) {
        bestVote[j] = vote; // the strongest vote is the "why this?"
        bestFrom[j] = row;
        bestPct[j] = nb.pct[k];
      }
    }
  }
  const reasonFor = (show: Show): Reason | null =>
    bestFrom[show.row] < 0 ? null : { because: catalog.shows[bestFrom[show.row]], pct: bestPct[show.row], tags: [] };
  return { scores, reasonFor };
}

// ---------- more like these ----------
export function byTags(catalog: Catalog, liked: Weighted[]) {
  const { tagStart, tagIds, tagWeights } = catalog;
  const n = catalog.shows.length;
  const taste = new Float64Array(catalog.tagNames.length);
  for (const { row, weight } of liked)
    for (let k = tagStart[row]; k < tagStart[row + 1]; k++) taste[tagIds[k]] += weight * tagWeights[k];
  let length = 0;
  for (const v of taste) length += v * v;
  length = Math.max(Math.sqrt(length), 1e-9);

  const scores = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    let s = 0;
    for (let k = tagStart[r]; k < tagStart[r + 1]; k++) s += tagWeights[k] * taste[tagIds[k]];
    scores[r] = s / length;
  }

  const reasonFor = (show: Show): Reason | null => {
    const r = show.row;
    const parts: { tag: number; part: number }[] = [];
    for (let k = tagStart[r]; k < tagStart[r + 1]; k++) parts.push({ tag: tagIds[k], part: tagWeights[k] * taste[tagIds[k]] });
    parts.sort((a, b) => b.part - a.part);
    // the liked show sharing the most of those tags
    const top = new Set(parts.slice(0, 5).map((p) => p.tag));
    let because = liked[0]?.row ?? 0;
    let most = -1;
    for (const { row } of liked) {
      let shared = 0;
      for (let k = tagStart[row]; k < tagStart[row + 1]; k++) if (top.has(tagIds[k])) shared += tagWeights[k];
      if (shared > most) [because, most] = [row, shared];
    }
    return {
      because: catalog.shows[because],
      pct: null,
      tags: parts.filter((p) => p.part > 0).slice(0, 3).map((p) => catalog.tagNames[p.tag]),
    };
  };
  return { scores, reasonFor };
}

/** The best-known shows you haven't rated: what to rate first (the start grid). */
export function popular(catalog: Catalog, ratings: Map<string, Tier>, allowed: (show: Show) => boolean): Show[] {
  return catalog.shows
    .filter((s) => s.recommend && !s.isNew && !ratings.has(s.key) && allowed(s))
    .sort((a, b) => b.popularity - a.popularity);
}

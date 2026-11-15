// The two recommendation modes, run in the browser on the files Python made (it takes a few
// milliseconds, so picks update the moment you rate something). Same math as recommend.py.
//
//   players: every game you liked "votes" for the games its players also liked (item-item collaborative filtering).
//            The links come from EASE (build_links.py), and each vote is the link's own weight.
//   tags:    your taste = the average tags of the games you liked; score every game by how close it is (cosine similarity)
import type { Catalog, Game } from "./data";
import type { Mode } from "../platforms";

export type Tier = "loved" | "liked" | "okay" | "disliked" | "hidden";
export const TIERS: Tier[] = ["loved", "liked", "okay", "disliked"];

// How hard each rating pulls similar games up. Tested against real players (evaluate.py --tiers, and
// Steam's thumbs-down reviews), see the accuracy walkthrough:
//   Okay = 0.1: you played it, and that alone says a little about your taste (it helped on every platform).
//   Disliked = 0: never recommended back, but they don't push similar games down. Pushing down
//     (the old -0.5 / -1) made picks worse everywhere: people who dislike a game still like its neighbors
//     more often than not (same genre, same series). A negative weight here would push down again.
//   Hidden = 0 too, and isn't even counted as a rating: it's just left out.
export const TIER_WEIGHT: Record<Tier, number> = { loved: 2, liked: 1, okay: 0.1, disliked: 0, hidden: 0 };

export interface Reason {
  because: Game; // the liked game that did the most to bring this one up
  pct: number | null; // players: % of players who liked `because` and also liked this one
  tags: number[]; // tags: the shared tags doing the most work
}

export interface Pick {
  game: Game;
  match: number; // 0-0.99: 1 would be your best match in the whole catalog
}

export interface Picks {
  picks: Pick[]; // every match, best first (the page shows them 24 at a time)
  liked: number; // how many loved and liked games from this platform went in
  rated: number; // every rating but hidden
  reasonFor: (game: Game) => Reason | null;
}

interface Weighted {
  row: number;
  weight: number;
}

/** Your ratings → this platform's games that pull picks up or push them down, with how much each one counts. */
function split(catalog: Catalog, ratings: Map<string, Tier>) {
  const liked: Weighted[] = []; // loved, liked and okay
  const disliked: Weighted[] = []; // only if a tier gets a negative weight again
  const rated = new Set<number>(); // never recommended back, whatever the rating
  let likes = 0; // loved + liked: picks need at least one
  let counted = 0;
  for (const [key, tier] of ratings) {
    const game = catalog.byKey.get(key); // Phase 2: games from other platforms count too (one IGDB ID)
    if (!game) continue;
    rated.add(game.row);
    const weight = TIER_WEIGHT[tier];
    if (weight > 0) liked.push({ row: game.row, weight });
    if (weight < 0) disliked.push({ row: game.row, weight: -weight });
    if (tier === "loved" || tier === "liked") likes++;
    if (tier !== "hidden") counted++; // hidden games are left out, they don't shape your taste
  }
  return { liked, disliked, likes, counted, rated };
}

export function recommend(
  catalog: Catalog,
  ratings: Map<string, Tier>,
  mode: Mode,
  allowed: (game: Game) => boolean,
): Picks {
  const { liked, disliked, likes, counted, rated } = split(catalog, ratings);
  const empty: Picks = { picks: [], liked: likes, rated: counted, reasonFor: () => null };
  if (!likes) return empty;

  const result = mode === "players" ? byPlayers(catalog, liked, disliked) : byTags(catalog, liked, disliked);
  if (!result) return empty;
  const { scores, reasonFor } = result;

  // Match %: 100% = your best match in the whole catalog, before filters.
  // With filters on, the top card can be lower: that's what the filters cost you.
  let best = 1e-9;
  const eligible: number[] = [];
  for (let g = 0; g < scores.length; g++) {
    // never what you've rated, nothing with no real match, and never a game today's consoles can't play
    if (rated.has(g) || !(scores[g] > 0) || catalog.games[g].rateOnly) continue;
    if (scores[g] > best) best = scores[g];
    if (allowed(catalog.games[g])) eligible.push(g);
  }
  eligible.sort((a, b) => scores[b] - scores[a]);

  return {
    picks: eligible.map((g) => ({ game: catalog.games[g], match: Math.min(scores[g] / best, 0.99) })),
    liked: likes,
    rated: counted,
    reasonFor,
  };
}

// ---------- players also liked ----------
function byPlayers(catalog: Catalog, liked: Weighted[], disliked: Weighted[]) {
  const nb = catalog.neighbors;
  if (!nb) return null; // still loading
  const n = catalog.games.length;
  const scores = new Float64Array(n);
  const bestVote = new Float64Array(n);
  const bestFrom = new Int32Array(n).fill(-1);
  const bestPct = new Uint8Array(n);

  /** Where a game's links start (null = no player data: released after it).
   *  The link weights are used as they are: a game whose links are all weak (its players went
   *  everywhere) votes weakly, and one with a strong, clear link votes hard. */
  function links(row: number) {
    return row < nb!.rows ? row * nb!.perGame : null;
  }

  for (const { row, weight } of liked) {
    const start = links(row);
    if (start === null) continue;
    for (let k = start; k < start + nb.perGame; k++) {
      const j = nb.idx[k];
      const vote = weight * nb.sim[k]; // loved games vote harder than liked ones
      scores[j] += vote;
      if (vote > bestVote[j]) {
        // remember which liked game gave the strongest vote: that's the "why this?"
        bestVote[j] = vote;
        bestFrom[j] = row;
        bestPct[j] = nb.pct[k];
      }
    }
  }
  for (const { row, weight } of disliked) {
    const start = links(row);
    if (start === null) continue;
    for (let k = start; k < start + nb.perGame; k++) scores[nb.idx[k]] -= weight * nb.sim[k];
  }

  const reasonFor = (game: Game): Reason | null =>
    bestFrom[game.row] < 0
      ? null
      : { because: catalog.games[bestFrom[game.row]], pct: bestPct[game.row], tags: [] };
  return { scores, reasonFor };
}

// ---------- more like these ----------
function byTags(catalog: Catalog, liked: Weighted[], disliked: Weighted[]) {
  const { tagStart, tagIds, tagWeights } = catalog;
  const n = catalog.games.length;
  const profile = new Float64Array(catalog.tagNames.en.length);

  // Taste profile = weighted average tag vector of the games you liked (loved ones count double, okay a little)...
  const total = liked.reduce((sum, l) => sum + l.weight, 0);
  for (const { row, weight } of liked)
    for (let k = tagStart[row]; k < tagStart[row + 1]; k++) profile[tagIds[k]] += (weight * tagWeights[k]) / total;
  // ...minus the games you didn't like (none at today's weights: on Steam, pushing tags down this way
  // took "More like these" from 4.1% to 2.4% for the old Hated tier, see TIER_WEIGHT)
  for (const { row, weight } of disliked)
    for (let k = tagStart[row]; k < tagStart[row + 1]; k++)
      profile[tagIds[k]] -= (weight * tagWeights[k]) / disliked.length;

  // Every game's tag vector has length 1, so dividing by the profile's length gives cosine similarity (-1 to 1)
  let length = 0;
  for (const v of profile) length += v * v;
  length = Math.max(Math.sqrt(length), 1e-9);

  const scores = new Float64Array(n);
  for (let g = 0; g < n; g++) {
    let s = 0;
    for (let k = tagStart[g]; k < tagStart[g + 1]; k++) s += tagWeights[k] * profile[tagIds[k]];
    scores[g] = s / length;
  }

  // "Why this?": the liked game it's closest to, and the tags doing the most work
  const scratch = new Float64Array(profile.length);
  const reasonFor = (game: Game): Reason => {
    const g = game.row;
    for (let k = tagStart[g]; k < tagStart[g + 1]; k++) scratch[tagIds[k]] = tagWeights[k];
    let closest = liked[0].row;
    let closeness = -Infinity;
    for (const { row } of liked) {
      let dot = 0;
      for (let k = tagStart[row]; k < tagStart[row + 1]; k++) dot += tagWeights[k] * scratch[tagIds[k]];
      if (dot > closeness) [closest, closeness] = [row, dot];
    }
    const tags: { tag: number; contribution: number }[] = [];
    for (let k = tagStart[g]; k < tagStart[g + 1]; k++) {
      scratch[tagIds[k]] = 0; // clean up for next time
      tags.push({ tag: tagIds[k], contribution: tagWeights[k] * profile[tagIds[k]] });
    }
    tags.sort((a, b) => b.contribution - a.contribution);
    return {
      because: catalog.games[closest],
      pct: null,
      tags: tags.filter((t) => profile[t.tag] > 0).slice(0, 3).map((t) => t.tag),
    };
  };
  return { scores, reasonFor };
}

/** The most-reviewed (consoles: most-played) games you haven't rated: what to rate first.
 *  Older-console games are in here on purpose: rating Halo 3 still shapes your Xbox picks. */
export function popular(catalog: Catalog, ratings: Map<string, Tier>, allowed: (game: Game) => boolean): Game[] {
  return catalog.games.filter((g) => !ratings.has(g.key) && allowed(g)).sort((a, b) => b.popularity - a.popularity);
}

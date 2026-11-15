// Bring in a list you already keep: AniList (by username, asked live from the browser: AniList allows it)
// or MyAnimeList (the export file, read in the browser: MyAnimeList's API can't be called from a browser).
// Scores become ratings by YOUR own average, the same signal the accuracy test uses ("scored above your
// own average" = liked): someone who gives everything 8s and someone who gives everything 6s both get
// sensible Loved / Liked / Okay / Disliked.
import { askAniList } from "./anilist";
import type { Catalog } from "./data";
import { TIER_WEIGHT, type Tier } from "./recommend";

export type Status = "completed" | "watching" | "paused" | "dropped" | "planning";

export interface ListEntry {
  mal: number; // MyAnimeList ID: what the site keys ratings on
  score: number; // 0-10, 0 = not scored
  status: Status;
}

const LOVED_ABOVE = 1.5; // points above your average
const DISLIKED_BELOW = 1.5; // points below it

/** Your list → ratings. Planned shows are left out (not watched yet). */
export function toRatings(entries: ListEntry[]): Map<number, Tier> {
  const scored = entries.filter((e) => e.score > 0 && e.status !== "planning");
  const average = scored.length ? scored.reduce((s, e) => s + e.score, 0) / scored.length : 0;
  // Everyone scored the same (e.g. only their favourites, all 10s): there's no "below average" to read,
  // so a score at the average means they liked it, not "okay"
  const oneScore = scored.length > 0 && scored.every((e) => e.score === scored[0].score);
  const out = new Map<number, Tier>();
  for (const e of entries) {
    if (e.status === "planning" || !e.mal) continue;
    let tier: Tier;
    if (e.score > 0) {
      if (e.score >= average + LOVED_ABOVE) tier = "loved";
      else if (e.score > average || (oneScore && e.score === average)) tier = "liked";
      else if (e.score > average - DISLIKED_BELOW && e.status !== "dropped") tier = "okay";
      else tier = "disliked";
    } else if (e.status === "dropped") tier = "disliked";
    else if (e.status === "completed") tier = "liked"; // finished it without scoring: most likely liked it
    else tier = "okay"; // watching or paused, no score yet
    out.set(e.mal, tier);
  }
  return out;
}

const rank = (t: Tier) => (t === "disliked" ? -1 : TIER_WEIGHT[t]);

/** A list → one rating per card (Import and Watch together): a show's seasons and movies all land on its
 *  card and the best rating wins. `missing` = entries the site has no card for (adult titles, music
 *  videos, shows with too few scores). */
export function cardRatings(catalog: Catalog, entries: ListEntry[]): { cards: Map<string, Tier>; missing: number } {
  const cards = new Map<string, Tier>();
  let missing = 0;
  for (const [mal, tier] of toRatings(entries)) {
    const show = catalog.byMal.get(mal) ?? catalog.byKey.get(`mal:${mal}`);
    if (!show) {
      missing++;
      continue;
    }
    const before = cards.get(show.key);
    if (!before || rank(tier) > rank(before)) cards.set(show.key, tier);
  }
  return { cards, missing };
}

// ---------- AniList ----------
const QUERY = `query ($name: String) {
  MediaListCollection(userName: $name, type: ANIME) {
    lists { entries { status score(format: POINT_10_DECIMAL) media { idMal } } }
  }
}`;
const ANILIST_STATUS: Record<string, Status> = {
  COMPLETED: "completed", CURRENT: "watching", REPEATING: "watching", PAUSED: "paused", DROPPED: "dropped", PLANNING: "planning",
};

export class ImportError extends Error {
  constructor(public code: "not_found" | "private" | "network" | "file", message: string = code) {
    super(message);
  }
}

export async function fetchAniList(username: string): Promise<ListEntry[]> {
  let answer;
  try {
    answer = await askAniList(QUERY, { name: username.trim() });
  } catch {
    throw new ImportError("network");
  }
  const body = answer.body;
  const error: string = body?.errors?.[0]?.message ?? "";
  if (/not found/i.test(error)) throw new ImportError("not_found");
  if (/private/i.test(error)) throw new ImportError("private");
  if (!answer.ok || !body?.data) throw new ImportError("network", error);
  const entries: ListEntry[] = [];
  for (const list of body.data.MediaListCollection?.lists ?? [])
    for (const e of list.entries ?? [])
      if (e.media?.idMal) entries.push({ mal: e.media.idMal, score: e.score ?? 0, status: ANILIST_STATUS[e.status] ?? "planning" });
  return entries;
}

// ---------- MyAnimeList export file (.xml or .xml.gz) ----------
const MAL_STATUS: Record<string, Status> = {
  "Completed": "completed", "Watching": "watching", "On-Hold": "paused", "Dropped": "dropped", "Plan to Watch": "planning",
};

export async function readMalFile(file: File): Promise<ListEntry[]> {
  let text: string;
  try {
    text = file.name.endsWith(".gz")
      ? await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text()
      : await file.text();
  } catch {
    throw new ImportError("file");
  }
  return parseMalXml(text);
}

export function parseMalXml(text: string): ListEntry[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror") || !doc.querySelector("myanimelist")) throw new ImportError("file");
  const field = (anime: Element, name: string) => anime.querySelector(name)?.textContent?.trim() ?? "";
  return [...doc.querySelectorAll("anime")].map((anime) => ({
    mal: Number(field(anime, "series_animedb_id")),
    score: Number(field(anime, "my_score")) || 0,
    status: MAL_STATUS[field(anime, "my_status")] ?? "planning",
  }));
}

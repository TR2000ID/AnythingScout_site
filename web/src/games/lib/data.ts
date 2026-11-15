// Loads the files in public/data/: which platforms have data (platforms.json), then each one's games,
// tags, prices and "players also liked" links. Python makes them: import_steam.py + update_steam.py
// (daily: prices, sales, new games) for Steam, export_web.py for PlayStation and Xbox (Phase 1: no
// covers or tags yet, those come with IGDB in Phase 2).
import { PLATFORMS, type Mode, type PlatformId } from "../platforms";
import { createStore } from "../state/createStore";
import { indexTitles, type SearchIndex } from "./search";

/** One platform's entry in platforms.json */
export interface PlatformInfo {
  games: number;
  tags: number;
  tag_weights: number;
  neighbor_rows: number;
  neighbors_per_game: number;
  images: string;
  flags: Record<string, number>;
  players_data_until: string;
  updated: string;
  /** Only when a platform has fewer modes than usual (PlayStation and Xbox: no tags until Phase 2) */
  modes?: Mode[];
  /** Consoles: players in the data (libraries) and how many of them have trophy/achievement history */
  players?: number;
  history_players?: number;
  /** Consoles: the dataset often leaves languages out, so "Japanese" can't be trusted to be complete */
  languages_partial?: boolean;
  /** The stores in the prices file (Steam: ["us", "jp"]). Missing = no prices for this platform */
  prices?: Store[];
  /** Steam, after update_steam.py: today's file names (games.20261008-071200.json...). Missing = the plain
   *  names (games.json). New names each day mean the files are never overwritten while they're in use. */
  files?: Partial<Record<"games" | "tags" | "tag_weights" | "prices", string>>;
}

/** Which Steam store's prices to show: the US one in dollars, or the Japanese one in yen */
export type Store = "us" | "jp";

export interface Price {
  now: number; // what it costs today ($12.49, ¥1700). 0 = free
  base: number; // the normal price
  discount: number; // % off today, 0 = not on sale
  ends: number | null; // when the sale ends (unix seconds), when Steam says
}

export interface Game {
  /** "steam:730". Ratings are saved under this key (Phase 2: an IGDB ID, the same on every platform) */
  key: string;
  platform: PlatformId;
  id: number; // the store's own ID (Steam app ID), or the dataset's game ID on consoles
  row: number; // position in its catalog: the number the recommendation files use
  title: string;
  titleJa: string | null;
  year: number;
  popularity: number; // Steam: number of reviews. Consoles: players in the data who have it
  positive: number | null; // Steam: % positive reviews. Consoles have no reviews
  consoles: string | null; // consoles only: "PS5 / PS4", "Xbox 360"...
  rateOnly: boolean; // you can rate it (it shapes your taste), but it's never recommended: PS3, Vita, most Xbox 360
  backcompat: boolean; // an Xbox 360 game that runs on Xbox One and Series X|S, so it can be recommended
  japanese: boolean;
  poster: string | null; // tall cover
  header: string | null; // wide cover
  /** Steam: the price in each store, null = that store doesn't sell it. null for the whole thing = no price data (consoles) */
  prices: Partial<Record<Store, Price | null>> | null;
  search: SearchIndex;
}

/** "Players also liked": for each game (row), its top links. Row r's links are at r*perGame … r*perGame+perGame-1 */
export interface Neighbors {
  idx: Uint16Array; // which game
  sim: Uint16Array; // how strongly linked, 0-65535 = 0-1
  pct: Uint8Array; // % of players who liked game r and also liked this one
  rows: number; // only the games in the player data have links (they come first)
  perGame: number;
}

export interface Catalog {
  platform: PlatformId;
  info: PlatformInfo;
  games: Game[];
  byKey: Map<string, Game>;
  tagNames: { en: string[]; ja: string[] };
  /** Game g's tags are tagIds[tagStart[g] … tagStart[g+1]-1], with their weights at the same spots in tagWeights */
  tagStart: Uint32Array;
  tagIds: Uint16Array;
  tagWeights: Float32Array;
  neighbors: Neighbors | null; // arrives a moment after the games
  pricesUpdated: string | null; // when update_steam.py got the prices (null = no prices)
}

export type Catalogs = Partial<Record<PlatformId, Catalog>>;

interface DataState {
  status: "loading" | "ready" | "error";
  platforms: Partial<Record<PlatformId, PlatformInfo>>;
  catalogs: Catalogs;
}

export const dataStore = createStore<DataState>({ status: "loading", platforms: {}, catalogs: {} });

const DATA = `${import.meta.env.BASE_URL}data/games/`;

// "no-cache" = always ask the server whether the file changed (if not, it answers "same as before" in a
// few bytes), so today's prices show up instead of the browser's copy from yesterday
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(DATA + path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchBytes(path: string): Promise<ArrayBuffer> {
  const response = await fetch(DATA + path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.arrayBuffer();
}

/** games.json: one list per field. Steam has reviews, art and tags; consoles have players and consoles. */
interface GamesFile {
  id: number[];
  title: string[];
  title_ja: (string | null)[];
  year: number[];
  flags: number[];
  reviews?: number[];
  positive?: number[];
  poster?: (string | null)[];
  header?: (string | null)[];
  tags?: number[][];
  players?: number[];
  consoles?: string[];
}

/** prices.json (update_steam.py): one list per field and store, in the order of `id` (Steam app IDs) */
interface StorePrices {
  price: (number | null)[]; // null = this store doesn't sell it
  base: (number | null)[]; // only filled in when it's on sale
  discount: number[];
  ends: (number | null)[];
}
type PricesFile = { updated: string; id: number[] } & Partial<Record<Store, StorePrices>>;

const NO_TAGS = { en: [] as string[], ja: [] as string[] };

/** A game's prices from prices.json. A sale that ended since the last update shows the normal price. */
function pricesAt(file: PricesFile, stores: Store[], i: number | undefined, now: number): Game["prices"] {
  if (i === undefined) return null; // not in prices.json (e.g. right after import_steam.py): unknown, not "not sold"
  const prices: Game["prices"] = {};
  for (const store of stores) {
    const list = file[store];
    const price = list?.price[i];
    if (!list || price === null || price === undefined) {
      prices[store] = null;
      continue;
    }
    const ends = list.ends[i];
    const over = ends !== null && ends * 1000 < now;
    const discount = over ? 0 : list.discount[i];
    const base = list.base[i] ?? price;
    prices[store] = { now: discount ? price : base, base, discount, ends: discount ? ends : null };
  }
  return prices;
}

async function loadCatalog(platform: PlatformId, info: PlatformInfo): Promise<Catalog> {
  const hasTags = info.tags > 0;
  const stores = info.prices ?? [];
  const path = (name: keyof NonNullable<PlatformInfo["files"]>, plain: string) => `${platform}/${info.files?.[name] ?? plain}`;
  const [file, tagNames, weights, prices] = await Promise.all([
    fetchJson<GamesFile>(path("games", "games.json")),
    hasTags ? fetchJson<{ en: string[]; ja: string[] }>(path("tags", "tags.json")) : NO_TAGS,
    hasTags ? fetchBytes(path("tag_weights", "tag_weights.f32")) : new ArrayBuffer(0),
    stores.length ? fetchJson<PricesFile>(path("prices", "prices.json")) : null,
  ]);
  const priceRow = new Map(prices?.id.map((id, i) => [id, i]));
  const now = Date.now();

  const n = file.id.length;
  const japaneseBit = info.flags.japanese ?? 0;
  const rateOnlyBit = info.flags.rate_only ?? 0;
  const backcompatBit = info.flags.backcompat ?? 0;
  const tagLists = file.tags ?? [];
  const tagStart = new Uint32Array(n + 1);
  for (let g = 0; g < n; g++) tagStart[g + 1] = tagStart[g] + (tagLists[g]?.length ?? 0);
  const tagIds = Uint16Array.from(tagLists.flat());
  const tagWeights = new Float32Array(weights);
  if (tagWeights.length !== tagIds.length) throw new Error(`${platform}: tag weights don't match the tags`);

  const games: Game[] = file.id.map((id, row) => ({
    key: `${platform}:${id}`,
    platform,
    id,
    row,
    title: file.title[row],
    titleJa: file.title_ja[row],
    year: file.year[row],
    popularity: file.reviews?.[row] ?? file.players?.[row] ?? 0,
    positive: file.positive?.[row] ?? null,
    consoles: file.consoles?.[row] ?? null,
    rateOnly: (file.flags[row] & rateOnlyBit) !== 0,
    backcompat: (file.flags[row] & backcompatBit) !== 0,
    japanese: (file.flags[row] & japaneseBit) !== 0,
    poster: file.poster?.[row] ? info.images + file.poster[row] : null,
    header: file.header?.[row] ? info.images + file.header[row] : null,
    prices: prices ? pricesAt(prices, stores, priceRow.get(id), now) : null,
    search: indexTitles([file.title[row], file.title_ja[row]]),
  }));

  return {
    platform,
    info,
    games,
    byKey: new Map(games.map((g) => [g.key, g])),
    tagNames,
    tagStart,
    tagIds,
    tagWeights,
    neighbors: null,
    pricesUpdated: prices?.updated ?? null,
  };
}

async function loadNeighbors(platform: PlatformId, info: PlatformInfo): Promise<Neighbors> {
  const [idx, sim, pct] = await Promise.all([
    fetchBytes(`${platform}/nbr_idx.u16`),
    fetchBytes(`${platform}/nbr_sim.u16`),
    fetchBytes(`${platform}/nbr_pct.u8`),
  ]);
  return {
    idx: new Uint16Array(idx),
    sim: new Uint16Array(sim),
    pct: new Uint8Array(pct),
    rows: info.neighbor_rows,
    perGame: info.neighbors_per_game,
  };
}

/** First start: one platform's games, then its links (bigger, and only "players also liked" needs them) */
async function loadPlatform(id: PlatformId, info: PlatformInfo) {
  const catalog = await loadCatalog(id, info);
  dataStore.set((s) => ({ ...s, catalogs: { ...s.catalogs, [id]: catalog } }));
  const neighbors = await loadNeighbors(id, info);
  dataStore.set((s) => ({ ...s, catalogs: { ...s.catalogs, [id]: { ...s.catalogs[id]!, neighbors } } }));
}

/** platforms.json, with Steam's steam/latest.json on top: the daily update_steam.py run writes that small
 *  file (today's file names, counts and update time) instead of changing platforms.json, so git doesn't see
 *  a change every day. No latest.json (a fresh copy of the repo) = the plain files git keeps. */
async function fetchPlatforms(): Promise<DataState["platforms"]> {
  const platforms = await fetchJson<DataState["platforms"]>("platforms.json");
  if (platforms.steam) {
    try {
      platforms.steam = { ...platforms.steam, ...(await fetchJson<Partial<PlatformInfo>>("steam/latest.json")) };
    } catch {
      // not there yet: the plain files
    }
  }
  return platforms;
}

/** Called once when the site starts. */
export async function loadData() {
  try {
    const platforms = await fetchPlatforms();
    dataStore.set((s) => ({ ...s, platforms }));
    await Promise.all(PLATFORMS.filter((p) => platforms[p.id]).map(({ id }) => loadPlatform(id, platforms[id]!)));
    dataStore.set((s) => ({ ...s, status: "ready" }));
  } catch (error) {
    console.error(error);
    dataStore.set((s) => ({ ...s, status: "error" }));
  }
}

/** After an update: load again only the platforms whose data changed (their "updated" time in platforms.json).
 *  What's on screen stays until the new games are in, and your ratings don't change (they're keyed by game). */
export async function reloadData() {
  try {
    const platforms = await fetchPlatforms();
    const before = dataStore.get().platforms;
    dataStore.set((s) => ({ ...s, platforms }));
    const changed = PLATFORMS.filter((p) => platforms[p.id] && platforms[p.id]!.updated !== before[p.id]?.updated);
    // Games and links swap in together: putting in the games first (with no links yet) would blank
    // For you and the Sales "match" sort while the links download again.
    await Promise.all(
      changed.map(async ({ id }) => {
        const info = platforms[id]!;
        const [catalog, neighbors] = await Promise.all([loadCatalog(id, info), loadNeighbors(id, info)]);
        dataStore.set((s) => ({ ...s, catalogs: { ...s.catalogs, [id]: { ...catalog, neighbors } } }));
      }),
    );
  } catch (error) {
    console.error(error); // keep showing what's already loaded
  }
}

/** Find a game by its key ("steam:730") in whichever catalog it belongs to. */
export function findGame(catalogs: Catalogs, key: string): Game | undefined {
  const platform = key.slice(0, key.indexOf(":")) as PlatformId;
  return catalogs[platform]?.byKey.get(key);
}

// Loads the files in public/data/ (made by export_web.py): the show cards, every title that leads to a
// card, "Fans also liked" links and "More like these" tags. The math then runs in the browser.
import { createStore } from "../state/createStore";
import { indexTitles, type SearchIndex } from "./search";

export interface Meta {
  cards: number;
  linked: number; // the first `linked` cards have "Fans also liked" links; the rest are newer than the scores
  neighbors: number; // links per card
  tags: number;
  tag_entries: number;
  search: number;
  genres: string[];
  cover_prefix: string;
  flags: { recommend: number; new: number };
  scores_until: string;
}

export interface Show {
  key: string; // "mal:5114": ratings are saved under this (the MyAnimeList ID, the same on AniList imports)
  row: number; // position in the files
  mal: number | null;
  title: string;
  titleJa: string | null;
  type: string | null; // TV, MOVIE, ONA, OVA, SPECIAL, MUSIC
  year: number | null;
  season: string | null; // WINTER / SPRING / SUMMER / FALL
  episodes: number | null;
  cover: string | null;
  genres: string[];
  popularity: number; // people in the scores who scored it (0 for newer shows)
  recommend: boolean; // a main show (not a special or a music video) with enough tags or links
  isNew: boolean; // newer than the scores: only "More like these" can pick it
  versions: number[]; // rows of other tellings of the same story (FMA 2003 / Brotherhood)
  search: SearchIndex;
}

export interface Neighbors {
  idx: Uint16Array;
  sim: Uint16Array;
  pct: Uint8Array;
  rows: number;
  perShow: number;
}

export interface Catalog {
  meta: Meta;
  shows: Show[];
  byKey: Map<string, Show>;
  byMal: Map<number, Show>; // every entry's MyAnimeList ID → its card (seasons and movies too): for list imports
  tagNames: string[];
  tagStart: Uint32Array;
  tagIds: Uint16Array;
  tagWeights: Float32Array;
  neighbors: Neighbors | null; // the biggest files: loaded after the cards, so search works sooner
}

export interface DataState {
  status: "loading" | "ready" | "error";
  catalog: Catalog | null;
}

export const dataStore = createStore<DataState>({ status: "loading", catalog: null });

const DATA = `${import.meta.env.BASE_URL}data/anime/`;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(DATA + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchBytes(path: string, expected: number): Promise<ArrayBuffer> {
  const response = await fetch(DATA + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== expected) throw new Error(`${path}: ${bytes.byteLength} bytes, expected ${expected}`);
  return bytes;
}

interface CardsFile {
  title: string[];
  title_ja: (string | null)[];
  type: (string | null)[];
  year: (number | null)[];
  season: (string | null)[];
  episodes: (number | null)[];
  cover: (string | null)[];
  genres: number[][];
  flags: number[];
  people: number[];
  mal: (number | null)[];
  anilist: (number | null)[]; // AniList ID, for newer cards that have no MyAnimeList ID
  versions: number[][];
}

/** The key ratings are saved under. Never a row number: rows move when the data is rebuilt, and a saved
 *  rating would then belong to another show. MyAnimeList ID first, else AniList's (newer shows). */
export function keyOf(mal: number | null, anilist: number | null, row: number): string {
  if (mal) return `mal:${mal}`;
  if (anilist) return `al:${anilist}`;
  return `card:${row}`; // export_web.py gives every card one of the two IDs; this is only a last resort
}

async function loadCatalog(): Promise<Catalog> {
  const meta = await fetchJson<Meta>("meta.json");
  const [cards, search, tags, ids, weights] = await Promise.all([
    fetchJson<CardsFile>("cards.json"),
    fetchJson<{ row: number[]; titles: (string | null)[][]; mal: (number | null)[] }>("search.json"),
    fetchJson<{ names: string[]; start: number[] }>("tags.json"),
    fetchBytes("tag_ids.u16", meta.tag_entries * 2),
    fetchBytes("tag_weights.f32", meta.tag_entries * 4),
  ]);
  // Every title that leads to a card: the card's own, and each season's / movie's
  const titlesOf: (string | null)[][] = Array.from({ length: meta.cards }, (_, r) => [cards.title[r], cards.title_ja[r]]);
  search.row.forEach((r, i) => titlesOf[r].push(...search.titles[i]));

  const shows: Show[] = cards.title.map((title, row) => {
    const cover = cards.cover[row];
    return {
      key: keyOf(cards.mal[row], cards.anilist[row], row),
      row,
      mal: cards.mal[row],
      title,
      titleJa: cards.title_ja[row],
      type: cards.type[row],
      year: cards.year[row],
      season: cards.season[row],
      episodes: cards.episodes[row],
      cover: cover ? (cover.startsWith("http") ? cover : meta.cover_prefix + cover) : null,
      genres: cards.genres[row].map((g) => meta.genres[g]),
      popularity: cards.people[row],
      recommend: (cards.flags[row] & meta.flags.recommend) !== 0,
      isNew: (cards.flags[row] & meta.flags.new) !== 0,
      versions: cards.versions[row],
      search: indexTitles(titlesOf[row]),
    };
  });
  return {
    meta,
    shows,
    byKey: new Map(shows.map((s) => [s.key, s])),
    byMal: new Map(search.mal.flatMap((m, i) => (m ? [[m, shows[search.row[i]]] as [number, Show]] : []))),
    tagNames: tags.names,
    tagStart: Uint32Array.from(tags.start),
    tagIds: new Uint16Array(ids),
    tagWeights: new Float32Array(weights),
    neighbors: null,
  };
}

async function loadNeighbors(meta: Meta): Promise<Neighbors> {
  const n = meta.linked * meta.neighbors;
  const [idx, sim, pct] = await Promise.all([
    fetchBytes("nbr_idx.u16", n * 2),
    fetchBytes("nbr_sim.u16", n * 2),
    fetchBytes("nbr_pct.u8", n),
  ]);
  return { idx: new Uint16Array(idx), sim: new Uint16Array(sim), pct: new Uint8Array(pct), rows: meta.linked, perShow: meta.neighbors };
}

/** Called once when the site starts. */
export async function loadData() {
  try {
    const catalog = await loadCatalog();
    dataStore.set({ status: "ready", catalog });
    const neighbors = await loadNeighbors(catalog.meta);
    dataStore.set((s) => ({ ...s, catalog: s.catalog && { ...s.catalog, neighbors } }));
  } catch (error) {
    console.error(error);
    dataStore.set((s) => ({ ...s, status: "error" }));
  }
}

// ---------- where to watch (watch.json, loaded the first time a popup asks) ----------
export interface WatchFile {
  sites: string[];
  links: [number, string][][]; // per card: [site number, address]
  official: (string | null)[];
  tmdb: (string | null)[]; // "tv:31911": what the server asks TMDB about (Japan)
}

let watchFile: Promise<WatchFile> | null = null;

export function loadWatch(): Promise<WatchFile> {
  watchFile ??= fetchJson<WatchFile>("watch.json");
  watchFile.catch(() => (watchFile = null)); // try again next time
  return watchFile;
}

export interface Provider {
  name: string;
  kind: "flatrate" | "free" | "ads" | "rent" | "buy";
  logo: string | null;
}

/** Japan (or another country): the site's own server asks TMDB. null = not available (no key yet, offline) */
export async function fetchProviders(tmdb: string, region: string): Promise<{ providers: Provider[]; link: string | null } | null> {
  try {
    const response = await fetch(`/api/watch?tmdb=${encodeURIComponent(tmdb)}&region=${region}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

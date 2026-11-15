// Where to watch in Japan (or any country), from TMDB's watch providers (JustWatch's data, which TMDB
// passes on for free with credit). TMDB needs a key, so this runs here on the server, never in the browser.
//   /api/watch?tmdb=tv:31911&region=JP → { providers: [{ name, kind, logo }], link }

export interface Provider {
  name: string; // "dアニメストア", "U-NEXT", "ABEMA", "Netflix"
  kind: "flatrate" | "free" | "ads" | "rent" | "buy"; // subscription, free, free with ads, rent, buy
  logo: string | null;
}

export interface WatchAnswer {
  region: string;
  providers: Provider[];
  link: string | null; // TMDB's page with the full list
}

export class WatchError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const KINDS: Provider["kind"][] = ["flatrate", "free", "ads", "rent", "buy"];
export const CACHE_SECONDS = 24 * 60 * 60; // what's on which service changes slowly: a day is plenty

/** "tv:31911" / "movie:12345" → its parts, or an error for anything else */
export function parseTmdb(raw: string | null): { kind: "tv" | "movie"; id: number } {
  const m = /^(tv|movie):(\d{1,9})$/.exec(raw ?? "");
  if (!m) throw new WatchError(400, "bad_tmdb", "tmdb must look like tv:31911 or movie:12345");
  return { kind: m[1] as "tv" | "movie", id: Number(m[2]) };
}

export function parseRegion(raw: string | null): string {
  const region = (raw ?? "JP").toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) throw new WatchError(400, "bad_region", "region is a two-letter country code");
  return region;
}

/** TMDB accepts a v3 API key (?api_key=) or a v4 read token (Authorization: Bearer); either works here */
export function tmdbRequest(key: string, kind: string, id: number): Request {
  const url = new URL(`https://api.themoviedb.org/3/${kind}/${id}/watch/providers`);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key.length > 40) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  return new Request(url, { headers });
}

/** TMDB's answer → one country's providers, each service once (its best kind: subscription first) */
export function pickRegion(body: any, region: string): WatchAnswer {
  const here = body?.results?.[region] ?? {};
  const seen = new Set<string>();
  const providers: Provider[] = [];
  for (const kind of KINDS)
    for (const p of here[kind] ?? []) {
      if (seen.has(p.provider_name)) continue;
      seen.add(p.provider_name);
      providers.push({ name: p.provider_name, kind, logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null });
    }
  return { region, providers, link: here.link ?? null };
}

export async function watch(q: URLSearchParams, key: string | undefined, fetcher: typeof fetch = fetch): Promise<WatchAnswer> {
  const { kind, id } = parseTmdb(q.get("tmdb"));
  const region = parseRegion(q.get("region"));
  if (!key) throw new WatchError(503, "no_key", "Where to watch in Japan isn't switched on yet (no TMDB key)");
  const response = await fetcher(tmdbRequest(key, kind, id));
  if (response.status === 404) return { region, providers: [], link: null };
  if (!response.ok) throw new WatchError(502, "upstream", `TMDB answered ${response.status}`);
  return pickRegion(await response.json(), region);
}

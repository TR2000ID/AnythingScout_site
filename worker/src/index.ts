// Anime Scout server (Cloudflare Worker). The site itself (web/dist) is served by Cloudflare before this
// runs; this only answers /api/... addresses:
//   /api/watch   ?tmdb=tv:31911&region=JP → where to watch it in that country (TMDB, needs TMDB_KEY)
import { CACHE_SECONDS, watch, WatchError } from "./watch";

interface Env {
  TMDB_KEY?: string;
}

function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

/** The cache's name for a question: tmdb + region only (region as watch() reads it: JP when missing) */
export function cacheKey(url: URL): string {
  const tmdb = encodeURIComponent(url.searchParams.get("tmdb") ?? "");
  const region = encodeURIComponent((url.searchParams.get("region") ?? "JP").toUpperCase());
  return `${url.origin}/api/watch?tmdb=${tmdb}&region=${region}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET") return json({ error: "method", message: "GET only" }, 405);
    const url = new URL(request.url);
    // No CORS headers: the site and this server share one address, so only our own site can read answers
    if (url.pathname !== "/api/watch") return json({ error: "not_found", message: "Not found" }, 404);

    // The same question within a day gets the saved answer (free Cloudflare cache; fewer TMDB calls).
    // The key is only the two things the answer depends on, so extra junk in the address can't skip the
    // cache and spend TMDB calls. Note: Cloudflare only promises this cache on custom domains, so on the
    // free *.workers.dev address it may do nothing; check with a repeat request after deploying.
    const cache = (caches as unknown as { default: Cache }).default;
    const key = cacheKey(url);
    const saved = await cache.match(key);
    if (saved) return saved;
    try {
      const answer = json(await watch(url.searchParams, env.TMDB_KEY), 200, CACHE_SECONDS);
      ctx.waitUntil(cache.put(key, answer.clone()));
      return answer;
    } catch (err) {
      if (err instanceof WatchError) return json({ error: err.code, message: err.message }, err.status);
      console.error(err);
      return json({ error: "server", message: "Something went wrong" }, 500);
    }
  },
};

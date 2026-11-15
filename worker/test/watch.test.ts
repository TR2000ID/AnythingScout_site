// Where to watch, with TMDB answered by a stand-in (no key or network needed).
import { describe, expect, it } from "vitest";
import { parseRegion, parseTmdb, pickRegion, tmdbRequest, watch } from "../src/watch";

const TMDB_ANSWER = {
  results: {
    JP: {
      link: "https://www.themoviedb.org/tv/31911/watch?locale=JP",
      flatrate: [
        { provider_name: "dアニメストア", logo_path: "/d.png" },
        { provider_name: "U-NEXT", logo_path: "/u.png" },
      ],
      buy: [{ provider_name: "U-NEXT", logo_path: "/u.png" }, { provider_name: "Amazon Video", logo_path: null }],
    },
    US: { flatrate: [{ provider_name: "Crunchyroll", logo_path: "/c.png" }] },
  },
};

const stand_in = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("where to watch", () => {
  it("one country's services, each once, subscription before buying", () => {
    const answer = pickRegion(TMDB_ANSWER, "JP");
    expect(answer.providers.map((p) => [p.name, p.kind])).toEqual([
      ["dアニメストア", "flatrate"],
      ["U-NEXT", "flatrate"],
      ["Amazon Video", "buy"],
    ]);
    expect(answer.providers[0].logo).toBe("https://image.tmdb.org/t/p/w92/d.png");
    expect(answer.link).toContain("watch");
  });

  it("a country with nothing: an empty list, not an error", () => expect(pickRegion(TMDB_ANSWER, "FR").providers).toEqual([]));

  it("only real TMDB IDs and country codes", () => {
    expect(parseTmdb("tv:31911")).toEqual({ kind: "tv", id: 31911 });
    expect(() => parseTmdb("person:1")).toThrow();
    expect(() => parseTmdb("tv:../x")).toThrow();
    expect(parseRegion(null)).toBe("JP");
    expect(() => parseRegion("Japan")).toThrow();
  });

  it("v3 key in the address, v4 token as a header", () => {
    expect(new URL(tmdbRequest("abc123", "tv", 1).url).searchParams.get("api_key")).toBe("abc123");
    const v4 = tmdbRequest("x".repeat(200), "movie", 2);
    expect(v4.headers.get("Authorization")).toMatch(/^Bearer /);
    expect(new URL(v4.url).searchParams.has("api_key")).toBe(false);
  });

  it("no key yet: says so clearly", async () => {
    await expect(watch(new URLSearchParams("tmdb=tv:1"), undefined, stand_in(200, {}))).rejects.toMatchObject({ code: "no_key", status: 503 });
  });

  it("with a key: asks TMDB and answers", async () => {
    const answer = await watch(new URLSearchParams("tmdb=tv:31911&region=jp"), "key", stand_in(200, TMDB_ANSWER));
    expect(answer.region).toBe("JP");
    expect(answer.providers).toHaveLength(3);
  });

  it("a show TMDB doesn't know: nothing, not an error", async () => {
    const answer = await watch(new URLSearchParams("tmdb=tv:9"), "key", stand_in(404, {}));
    expect(answer.providers).toEqual([]);
  });
});

describe("cache key (audit 2026-11-06)", () => {
  it("only tmdb + region: extra junk in the address can't skip the cache", async () => {
    const { cacheKey } = await import("../src/index");
    const a = cacheKey(new URL("https://x.test/api/watch?tmdb=tv:31911&region=JP"));
    const b = cacheKey(new URL("https://x.test/api/watch?region=jp&junk=123&tmdb=tv:31911"));
    expect(a).toBe(b);
  });
});

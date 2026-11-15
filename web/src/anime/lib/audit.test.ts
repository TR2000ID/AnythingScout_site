// Cases from the 2026-11-06 audit: each one gave a wrong result before its fix.   npm test
import { describe, expect, it } from "vitest";
import { buildIcs, fold, type Airing } from "./calendar";
import { keyOf } from "./data";
import { toRatings, type ListEntry } from "./importList";

const entry = (mal: number, score: number, status: ListEntry["status"] = "completed"): ListEntry => ({ mal, score, status });

describe("list import", () => {
  it("someone who only scored favourites (all 10s) gets Liked, not Okay", () => {
    const tiers = toRatings([entry(1, 10), entry(2, 10), entry(3, 0)]);
    expect([tiers.get(1), tiers.get(2), tiers.get(3)]).toEqual(["liked", "liked", "liked"]);
  });

  it("a single scored show counts as liked", () => {
    expect(toRatings([entry(1, 9)]).get(1)).toBe("liked");
  });

  it("with a spread of scores, the average is still Okay", () => {
    const tiers = toRatings([entry(1, 10), entry(2, 7), entry(3, 4)]);
    expect(tiers.get(2)).toBe("okay");
  });
});

describe("rating keys", () => {
  it("newer shows without a MyAnimeList ID are keyed by AniList ID, never by row", () => {
    expect(keyOf(5114, 5114, 0)).toBe("mal:5114");
    expect(keyOf(null, 189581, 9000)).toBe("al:189581");
  });
});

describe("calendar file", () => {
  const show: Airing = { mal: 5, title: "A".repeat(120), next: 1_800_000_000, episode: 3, last: 12 };

  it("one ID per show, so a newer file updates the show instead of adding it again", () => {
    const thisWeek = buildIcs([show], (n) => `(ep ${n}+)`, 0);
    const nextWeek = buildIcs([{ ...show, episode: 4, next: show.next + 604800 }], (n) => `(ep ${n}+)`, 0);
    const uid = (ics: string) => /UID:(.*)/.exec(ics)![1].trim();
    expect(uid(thisWeek)).toBe(uid(nextWeek));
  });

  it("no line is longer than 75 bytes, and folding keeps Japanese letters whole", () => {
    const ics = buildIcs([show, { ...show, mal: 6, title: "進撃の巨人".repeat(10) }], (n) => `（第${n}話〜）`, 0);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain("進撃の巨人".repeat(10) + " （第3話〜）");
  });

  it("fold leaves short lines alone", () => {
    expect(fold("SUMMARY:short")).toBe("SUMMARY:short");
  });
});

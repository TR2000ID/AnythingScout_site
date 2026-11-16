// The five things an account carries, seen through one shape each (sections.ts). Groundwork: the site
// behaves exactly as before; these only make the saved lists readable and writable from outside.   npm test
import { fakeStorage } from "./test-env";
import { beforeEach, describe, expect, it } from "vitest";

const anime = await import("../../anime/state/settings");
const games = await import("../../games/state/settings");
const { friendsStore } = await import("../../anime/state/friends");
const { ratingsStore: animeRatings } = await import("../../anime/state/ratings");
const sections = await import("./sections");

const block = (name: string) => sections.BLOCK_SECTIONS.find((b) => b.name === name)!;
const ratings = (section: string) => sections.RATING_SECTIONS.find((r) => r.section === section)!;

beforeEach(() => sections.clearLocal());

describe("settingsFrom / savedForm", () => {
  it("Games keeps valid saved fields and drops bad ones", () => {
    const s = games.settingsFrom({ store: "jp", lang: "xx" });
    expect(s.store).toBe("jp");
    expect(s.lang).toBe(games.DEFAULTS.lang);
    expect(games.settingsFrom({ platform: "dreamcast", mode: "tags" })).toMatchObject({ platform: "steam", mode: "tags" });
  });

  it("Anime with nothing saved = the defaults", () => {
    expect(anime.settingsFrom(null)).toEqual(anime.DEFAULTS);
  });

  it("savedForm keeps only what differs from the defaults", () => {
    const other = anime.DEFAULTS.titles === "en" ? "ja" : "en";
    expect(anime.savedForm(anime.settingsFrom({ titles: other }))).toEqual({ titles: other });
    expect(games.savedForm(games.DEFAULTS)).toEqual({});
  });
});

describe("block sections", () => {
  it("settings: replace(get()) changes nothing; a changed block is applied", () => {
    const b = block("anime.settings");
    anime.updateSettings({ gems: 0.5 });
    const before = anime.settingsStore.get();
    b.replace(b.get());
    expect(anime.settingsStore.get()).toEqual(before);
    b.replace(JSON.stringify({ gems: 1 }));
    expect(anime.settingsStore.get().gems).toBe(1);
    expect(JSON.parse(b.get())).toEqual({ gems: 1 });
  });

  it("a broken value is ignored", () => {
    const b = block("games.settings");
    games.updateSettings({ store: "jp" });
    b.replace("{not json");
    expect(games.settingsStore.get().store).toBe("jp");
  });

  it("friends: replace keeps only real friends", () => {
    const b = block("anime.friends");
    b.replace(JSON.stringify([{ name: "Mika", ratings: { "mal:1": "liked" } }, { junk: true }]));
    expect(friendsStore.get()).toEqual([{ name: "Mika", ratings: { "mal:1": "liked" } }]);
    expect(JSON.parse(b.get())).toEqual([{ name: "Mika", ratings: { "mal:1": "liked" } }]);
    b.replace('"not a list"');
    expect(friendsStore.get()).toHaveLength(1);
  });

  it("get() reads the saved copy, so a tab whose memory is behind still reports what's saved", () => {
    fakeStorage.setItem("anime-scout.settings", JSON.stringify({ gems: 1 }));
    expect(JSON.parse(block("anime.settings").get())).toEqual({ gems: 1 });
  });
});

describe("rating sections", () => {
  it("replace keeps the given dates and get() gives them back", () => {
    const r = ratings("anime");
    r.replace(new Map([["mal:1", { rating: "loved", at: "2026-01-01T00:00:00.000Z" }]]));
    expect(animeRatings.get().get("mal:1")).toEqual({ show: "mal:1", rating: "loved", at: "2026-01-01T00:00:00.000Z" });
    expect(r.get()).toEqual(new Map([["mal:1", { rating: "loved", at: "2026-01-01T00:00:00.000Z" }]]));
  });

  it("games rows use the game key", () => {
    const r = ratings("games");
    r.replace(new Map([["steam:730", { rating: "liked", at: "2026-01-01T00:00:00.000Z" }]]));
    expect(r.get().get("steam:730")?.rating).toBe("liked");
  });

  it("subscribe hears changes", () => {
    let heard = 0;
    const stop = ratings("games").subscribe(() => heard++);
    ratings("games").replace(new Map());
    stop();
    ratings("games").replace(new Map());
    expect(heard).toBe(1);
  });
});

describe("snapshotLocal / restoreLocal / clearLocal", () => {
  it("set aside, clear, and put back", () => {
    ratings("anime").replace(new Map([["mal:1", { rating: "loved", at: "2026-01-01T00:00:00.000Z" }]]));
    block("anime.friends").replace(JSON.stringify([{ name: "Mika", ratings: {} }]));
    games.updateSettings({ store: "jp" });
    const snap = sections.snapshotLocal();
    sections.clearLocal();
    expect(animeRatings.get().size).toBe(0);
    expect(friendsStore.get()).toEqual([]);
    expect(games.settingsStore.get()).toEqual(games.DEFAULTS);
    sections.restoreLocal(snap);
    expect(animeRatings.get().get("mal:1")?.rating).toBe("loved");
    expect(friendsStore.get()).toEqual([{ name: "Mika", ratings: {} }]);
    expect(games.settingsStore.get().store).toBe("jp");
  });
});

// Addresses inside the site: /section/page, old Anime Scout #/ links, and which section opens first.   npm test
import { describe, expect, it } from "vitest";
import { homeFor, legacyRedirect, parseRoute } from "./route";

describe("parseRoute", () => {
  it("reads section and page", () => expect(parseRoute("/anime/liked")).toEqual({ section: "anime", page: "liked" }));
  it("section home with or without slash", () => {
    expect(parseRoute("/anime")).toEqual({ section: "anime", page: "" });
    expect(parseRoute("/anime/")).toEqual({ section: "anime", page: "" });
  });
  it("root and unknown sections are not routes", () => {
    expect(parseRoute("/")).toBeNull();
    expect(parseRoute("/foo/bar")).toBeNull();
  });
});

describe("legacyRedirect", () => {
  it("old Anime Scout hash links go to /anime/", () => {
    expect(legacyRedirect("/", "#/liked", "")).toBe("/anime/liked");
    expect(legacyRedirect("/", "#/", "")).toBe("/anime/");
    expect(legacyRedirect("/", "#/together", "?mine")).toBe("/anime/together?mine");
  });
  it("new-style addresses are left alone", () => {
    expect(legacyRedirect("/anime/liked", "", "")).toBeNull();
    expect(legacyRedirect("/", "", "")).toBeNull();
  });
});

describe("homeFor", () => {
  it("last section used wins when it's ready", () => expect(homeFor("anime", ["games", "anime"], false)).toBe("anime"));
  it("first visit: Games, unless they already have Anime ratings", () => {
    expect(homeFor(null, ["games", "anime"], false)).toBe("games");
    expect(homeFor(null, ["games", "anime"], true)).toBe("anime");
  });
  it("a saved section that isn't ready yet falls back", () => expect(homeFor("games", ["anime"], false)).toBe("anime"));
  it("junk in storage falls back", () => expect(homeFor("{oops", ["anime"], false)).toBe("anime"));
});

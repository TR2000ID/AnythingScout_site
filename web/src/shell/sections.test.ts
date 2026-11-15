// Each section's data downloads the first time that section is shown, never before (Games alone is ~18 MB).   npm test
import { describe, expect, it } from "vitest";
import { barLang, onceEach } from "./sections";

describe("each section loads once, when first shown", () => {
  it("runs each loader once", () => {
    const calls: string[] = [];
    const show = onceEach({ games: () => calls.push("games"), anime: () => calls.push("anime") });
    for (const s of ["games", "games", "anime", "games"] as const) show(s);
    expect(calls).toEqual(["games", "anime"]);
  });
  it("a section without a loader is fine", () => expect(() => onceEach({})("manga")).not.toThrow());
});

describe("the bar's language follows the section on screen", () => {
  it("Games uses Games' setting", () => expect(barLang("games", "en", "ja")).toBe("ja"));
  it("anything else uses Anime's", () => {
    expect(barLang("anime", "en", "ja")).toBe("en");
    expect(barLang("manga", "en", "ja")).toBe("en");
    expect(barLang(undefined, "en", "ja")).toBe("en");
  });
});

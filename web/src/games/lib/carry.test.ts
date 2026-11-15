// The one-time copy of Game Scout ratings: the data rides in the link after #, which browsers never send to
// a server, and must arrive exactly as it was saved.   npm test
import { describe, expect, it } from "vitest";
import { decodeCarry, encodeCarry, planCarry, type CarryData } from "./carry";

const data: CarryData = {
  ratings: JSON.stringify({ version: 1, rows: [{ game: "steam:620", tier: "liked", title: "進撃 </script> \"quotes\"" }] }),
  settings: JSON.stringify({ lang: "ja", store: "jp" }),
};

describe("carry link", () => {
  it("round-trips exactly, Japanese, quotes and </script> included", () => expect(decodeCarry(encodeCarry(data))).toEqual(data));
  it("takes the # too", () => expect(decodeCarry("#" + encodeCarry(data))).toEqual(data));
  it("only link-safe characters", () => expect(encodeCarry(data)).toMatch(/^[A-Za-z0-9_-]+$/));
  it("settings may be missing", () => expect(decodeCarry(encodeCarry({ ...data, settings: null }))).toEqual({ ...data, settings: null }));
  it("junk is null", () => {
    expect(decodeCarry("#%%%")).toBeNull();
    expect(decodeCarry("")).toBeNull();
    expect(decodeCarry("#" + btoa("[1,2]"))).toBeNull();
  });
});

describe("what to do with ratings already there", () => {
  it("nothing there: write", () => expect(planCarry(data, null)).toBe("write"));
  it("the same: nothing to do", () => expect(planCarry(data, data.ratings)).toBe("same"));
  it("different ratings: ask first", () => expect(planCarry(data, '{"version":1,"rows":[]}')).toBe("ask"));
});

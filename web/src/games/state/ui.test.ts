// Games' pages live in the address (/games/sales), like Anime's: these are the two halves of that.   npm test
import { describe, expect, it } from "vitest";
import { hrefOf, pageFromPath } from "./ui";

describe("Games pages in the address", () => {
  it("reads a known page", () => expect(pageFromPath("sales")).toBe("sales"));
  it("no page or an unknown one is For you", () => {
    expect(pageFromPath("")).toBe("for-you");
    expect(pageFromPath("nope")).toBe("for-you");
  });
  it("links point under /games/", () => {
    expect(hrefOf("for-you")).toBe("/games/");
    expect(hrefOf("liked")).toBe("/games/liked");
  });
});

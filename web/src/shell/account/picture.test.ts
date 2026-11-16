// Profile pictures are cropped to a centered square before shrinking (picture.ts).   npm test
import { describe, expect, it } from "vitest";
import { squareCrop } from "./picture";

describe("squareCrop", () => {
  it("wide: the middle square", () => expect(squareCrop(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 }));
  it("tall: the middle square", () => expect(squareCrop(300, 400)).toEqual({ sx: 0, sy: 50, size: 300 }));
  it("already square: all of it", () => expect(squareCrop(128, 128)).toEqual({ sx: 0, sy: 0, size: 128 }));
  it("odd sizes land on whole pixels", () => expect(squareCrop(401, 300)).toEqual({ sx: 50, sy: 0, size: 300 }));
});

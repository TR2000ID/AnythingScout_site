// "Update now" runs update_steam.py inside the game-scout repo next to this one.   npm test
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gameScoutRepo, pythonFor } from "./update-plugin";

describe("where Update now finds Game Scout", () => {
  it("GAME_SCOUT_REPO wins when set", () => expect(gameScoutRepo("C:/x")).toBe("C:/x"));
  it("otherwise the game-scout folder next to anything-scout", () =>
    expect(gameScoutRepo(undefined).replaceAll("\\", "/")).toMatch(/\/Projects\/game-scout\/$/));
  it("a repo without .venv uses plain python", () => expect(pythonFor(mkdtempSync(join(tmpdir(), "gs-")))).toBe("python"));
});

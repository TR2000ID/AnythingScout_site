// This Worker ("anime-scout") serves the live site since 2026-11-15 (Anime went live early, Games and Manga "Soon").
// A habitual `npm run deploy` would send whatever is on main live, unfinished work included, so `deploy` refuses;
// the real command is `deploy:golive`, run only with the user's OK (then the `live` git tag moves).   npm test
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")).scripts as Record<string, string>;

describe("no deploy without an OK", () => {
  it("npm run deploy does not run wrangler deploy", () => expect(scripts.deploy).not.toMatch(/wrangler\s+deploy/));
  it("the real deploy command is kept under deploy:golive", () => expect(scripts["deploy:golive"]).toMatch(/wrangler\s+deploy/));
});

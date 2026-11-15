// Step 1-3 guard: the Worker is named "anime-scout" on purpose (go-live keeps the live address), so a habitual
// `npm run deploy` here would replace the live Anime Scout site with this unfinished one. Until go-live (step 4),
// `deploy` must refuse; the real command waits under `deploy:golive`.   npm test
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")).scripts as Record<string, string>;

describe("no deploy before go-live", () => {
  it("npm run deploy does not run wrangler deploy", () => expect(scripts.deploy).not.toMatch(/wrangler\s+deploy/));
  it("the real deploy command is kept for step 4", () => expect(scripts["deploy:golive"]).toMatch(/wrangler\s+deploy/));
});

// The sync route: each rating merged on its own by its date (newer wins, removals included), settings and the
// Watch together list as whole blocks (newer wins), and revisions so a device only downloads what changed.
import { beforeEach, describe, expect, it } from "vitest";
import { mergeRow } from "../src/sync";
import { account, call, newEnv, type FakeEnv } from "./helpers";

let env: FakeEnv;
let token: string;

const T = (hhmm: string) => `2026-11-15T${hhmm}:00.000Z`;
const item = (it: string, rating: string | null, at: string, section = "games") => ({ section, item: it, rating, at });
const sync = (body: unknown, t = token) => call(env, "POST", "/account/sync", body, { token: t });
const rowCount = (table: string) => (env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(async () => {
  env = newEnv();
  token = await account(env, "Ken");
});

describe("mergeRow", () => {
  it("no existing row, or a newer one, wins; older or equal loses", () => {
    expect(mergeRow(null, { at: T("10:00") })).toBe(true);
    expect(mergeRow({ at: T("10:00") }, { at: T("10:05") })).toBe(true);
    expect(mergeRow({ at: T("10:00") }, { at: T("09:00") })).toBe(false);
    expect(mergeRow({ at: T("10:00") }, { at: T("10:00") })).toBe(false);
  });
});

describe("sync", () => {
  it("an empty account answers nothing at rev 0", async () => {
    const r = await sync({ rev: 0, items: [], blocks: [] });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ rev: 0, items: [], blocks: [] });
  });

  it("sends two ratings → rev 1 with both; asking from rev 1 → nothing new", async () => {
    const sent = [item("steam:730", "liked", T("10:00")), item("steam:570", "loved", T("10:01"))];
    const r = await sync({ rev: 0, items: sent, blocks: [] });
    expect(r.body.rev).toBe(1);
    expect(r.body.items).toEqual(expect.arrayContaining(sent));
    expect(r.body.items).toHaveLength(2);
    expect((await sync({ rev: 1, items: [], blocks: [] })).body).toEqual({ rev: 1, items: [], blocks: [] });
  });

  it("the newer date wins, both ways", async () => {
    await sync({ rev: 0, items: [item("steam:730", "liked", T("10:00"))], blocks: [] });
    const older = await sync({ rev: 1, items: [item("steam:730", "loved", T("09:00"))], blocks: [] });
    expect(older.body).toEqual({ rev: 1, items: [], blocks: [] }); // nothing won: no new rev, nothing to download
    const newer = await sync({ rev: 1, items: [item("steam:730", "loved", T("10:05"))], blocks: [] });
    expect(newer.body.rev).toBe(2);
    expect(newer.body.items).toEqual([item("steam:730", "loved", T("10:05"))]);
  });

  it("a removal at 10:05 beats a rating at 10:00, and comes back as rating null", async () => {
    await sync({ rev: 0, items: [item("steam:730", "liked", T("10:00"))], blocks: [] });
    const r = await sync({ rev: 1, items: [item("steam:730", null, T("10:05"))], blocks: [] });
    expect(r.body.items).toEqual([item("steam:730", null, T("10:05"))]);
    const fresh = await sync({ rev: 0, items: [], blocks: [] });
    expect(fresh.body.items).toEqual([item("steam:730", null, T("10:05"))]);
  });

  it("a rating at 10:05 beats a removal at 10:00", async () => {
    await sync({ rev: 0, items: [item("steam:730", null, T("10:00"))], blocks: [] });
    const r = await sync({ rev: 1, items: [item("steam:730", "liked", T("10:05"))], blocks: [] });
    expect(r.body.items).toEqual([item("steam:730", "liked", T("10:05"))]);
  });

  it("an older removal does not remove a newer rating", async () => {
    await sync({ rev: 0, items: [item("steam:730", "liked", T("10:05"))], blocks: [] });
    await sync({ rev: 1, items: [item("steam:730", null, T("10:00"))], blocks: [] });
    expect((await sync({ rev: 0, items: [], blocks: [] })).body.items).toEqual([item("steam:730", "liked", T("10:05"))]);
  });

  it("the same date on both sides: the server's copy stays", async () => {
    await sync({ rev: 0, items: [item("steam:730", "liked", T("10:00"))], blocks: [] });
    await sync({ rev: 1, items: [item("steam:730", "disliked", T("10:00"))], blocks: [] });
    expect((await sync({ rev: 0, items: [], blocks: [] })).body.items).toEqual([item("steam:730", "liked", T("10:00"))]);
  });

  it("the same item in anime and games is two rows", async () => {
    await sync({ rev: 0, items: [item("x:1", "liked", T("10:00"), "anime"), item("x:1", "okay", T("10:00"), "games")], blocks: [] });
    expect(rowCount("items")).toBe(2);
  });

  it("blocks: newer replaces, older is ignored", async () => {
    const block = (value: string, at: string) => ({ name: "anime.settings", value, at });
    await sync({ rev: 0, items: [], blocks: [block('{"titles":"ja"}', T("10:00"))] });
    const older = await sync({ rev: 1, items: [], blocks: [block('{"titles":"en"}', T("09:00"))] });
    expect(older.body.blocks).toEqual([]);
    const newer = await sync({ rev: 1, items: [], blocks: [block('{"gems":1}', T("10:05"))] });
    expect(newer.body.blocks).toEqual([block('{"gems":1}', T("10:05"))]);
    expect((await sync({ rev: 0, items: [], blocks: [] })).body.blocks).toEqual([block('{"gems":1}', T("10:05"))]);
  });

  it("an unknown block name → 400", async () => {
    const r = await sync({ rev: 0, items: [], blocks: [{ name: "anime.secret", value: "{}", at: T("10:00") }] });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("bad_sync");
  });

  it("a 600-show import is stored whole (writes are chunked under D1's 100 bound values)", async () => {
    const many = Array.from({ length: 600 }, (_, i) => item(`mal:${i + 1}`, "liked", T("10:00"), "anime"));
    const r = await sync({ rev: 0, items: many, blocks: [] });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(600);
    expect(rowCount("items")).toBe(600);
    // and a second, newer pass over the same 600 (the existing rows are read in chunks too)
    const again = await sync({ rev: 1, items: many.map((m) => ({ ...m, rating: "loved", at: T("11:00") })), blocks: [] });
    expect(again.body.items.every((m: { rating: string }) => m.rating === "loved")).toBe(true);
  });

  it("5,001 items in one request → 400", async () => {
    const many = Array.from({ length: 5001 }, (_, i) => item(`mal:${i + 1}`, "liked", T("10:00"), "anime"));
    expect((await sync({ rev: 0, items: many, blocks: [] })).status).toBe(400);
  });

  it("a 1,000,000-character Watch together list is accepted", async () => {
    const r = await sync({ rev: 0, items: [], blocks: [{ name: "anime.friends", value: "x".repeat(1_000_000), at: T("10:00") }] });
    expect(r.status).toBe(200);
    expect(rowCount("blocks")).toBe(1);
  });

  it("1,000,001 characters → 413 too_big, and nothing from that request is written", async () => {
    const r = await sync({
      rev: 0,
      items: [item("steam:730", "liked", T("10:00"))],
      blocks: [{ name: "anime.friends", value: "x".repeat(1_000_001), at: T("10:00") }],
    });
    expect(r.status).toBe(413);
    expect(r.body).toEqual({ error: "too_big", name: "anime.friends" });
    expect(rowCount("items")).toBe(0);
    expect(rowCount("blocks")).toBe(0);
  });

  it("refuses bad input and writes nothing", async () => {
    for (const bad of [
      { rev: 0, items: [item("steam 730", "liked", T("10:00"))], blocks: [] },
      { rev: 0, items: [item("steam:730", "hated", T("10:00"))], blocks: [] },
      { rev: 0, items: [item("steam:730", "liked", "yesterday")], blocks: [] },
      { rev: 0, items: [{ ...item("steam:730", "liked", T("10:00")), section: "manga" }], blocks: [] },
      { rev: -1, items: [], blocks: [] },
      { items: [], blocks: [] },
      { rev: 0, items: "no", blocks: [] },
    ]) {
      const r = await sync(bad);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("bad_sync");
    }
    expect(rowCount("items")).toBe(0);
  });

  it("dates are stored in one form, so comparing them as text stays right", async () => {
    await sync({ rev: 0, items: [item("steam:730", "liked", "2026-11-15T10:00:00Z")], blocks: [] });
    expect((await sync({ rev: 0, items: [], blocks: [] })).body.items[0].at).toBe(T("10:00"));
  });

  it("needs a session", async () => {
    expect((await sync({ rev: 0, items: [], blocks: [] }, "")).status).toBe(401);
  });

  it("two accounts never see each other's rows", async () => {
    const other = await account(env, "Mika");
    await sync({ rev: 0, items: [item("steam:730", "liked", T("10:00"))], blocks: [{ name: "games.settings", value: "{}", at: T("10:00") }] });
    const r = await sync({ rev: 0, items: [], blocks: [] }, other);
    expect(r.body).toEqual({ rev: 0, items: [], blocks: [] });
  });

  it("me.empty turns false after one rating syncs", async () => {
    expect((await call(env, "GET", "/account/me", undefined, { token })).body.empty).toBe(true);
    await sync({ rev: 0, items: [item("steam:730", "liked", T("10:00"))], blocks: [] });
    expect((await call(env, "GET", "/account/me", undefined, { token })).body.empty).toBe(false);
  });
});

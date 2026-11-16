// The sync engine: what to send, how to take in the answer, and the first sign-in on a browser that already
// has ratings. Pure functions, so every case here runs without a browser or a server.   npm test
import { describe, expect, it } from "vitest";
import { addChoice, applyPull, emptySnapshot, firstSignIn, nextSnapshot, planPush, settle, type Local, type Snapshot } from "./engine";
import type { SyncAnswer, SyncItem } from "./types";

const T = (hhmm: string) => `2026-11-15T${hhmm}:00.000Z`;
const NOW = T("12:00");
const local = (items: Record<string, [string, string]> = {}, blocks: Record<string, string> = {}): Local => ({
  items: new Map(Object.entries(items).map(([k, [rating, at]]) => [k, { rating, at }])),
  blocks: new Map(Object.entries(blocks)),
});
const snap = (items: Record<string, [string | null, string]> = {}, blocks: Record<string, [string, string]> = {}, rev = 1): Snapshot => ({
  rev,
  items: Object.fromEntries(Object.entries(items).map(([k, [rating, at]]) => [k, { rating, at }])),
  blocks: Object.fromEntries(Object.entries(blocks).map(([k, [value, at]]) => [k, { value, at }])),
});
const row = (key: string, rating: string | null, at: string): SyncItem => {
  const [section, item] = key.split("|") as ["anime" | "games", string];
  return { section, item, rating, at };
};

describe("planPush", () => {
  it("nothing changed → nothing to send", () => {
    const s = snap({ "games|steam:730": ["liked", T("10:00")] }, { "games.settings": ["{}", T("10:00")] });
    expect(planPush(s, local({ "games|steam:730": ["liked", T("10:00")] }, { "games.settings": "{}" }), {}, {}, NOW)).toEqual({ items: [], blocks: [] });
  });

  it("a new local rating → sent with its own date", () => {
    const p = planPush(emptySnapshot(), local({ "anime|mal:1": ["loved", T("10:00")] }), {}, {}, NOW);
    expect(p.items).toEqual([row("anime|mal:1", "loved", T("10:00"))]);
  });

  it("a changed rating → sent", () => {
    const s = snap({ "games|steam:730": ["liked", T("10:00")] });
    expect(planPush(s, local({ "games|steam:730": ["loved", T("10:30")] }), {}, {}, NOW).items).toEqual([row("games|steam:730", "loved", T("10:30"))]);
  });

  it("removed locally → a removal at the time it was removed; without one, now", () => {
    const s = snap({ "games|steam:730": ["liked", T("10:00")], "games|steam:570": ["okay", T("10:00")] });
    const p = planPush(s, local(), { "games|steam:730": T("10:05") }, {}, NOW);
    expect(p.items).toEqual(expect.arrayContaining([row("games|steam:730", null, T("10:05")), row("games|steam:570", null, NOW)]));
    expect(p.items).toHaveLength(2);
  });

  it("an item already removed in the snapshot isn't removed again", () => {
    expect(planPush(snap({ "games|steam:730": [null, T("10:00")] }), local(), {}, {}, NOW).items).toEqual([]);
  });

  it("a changed block → sent, at its change time or now", () => {
    const s = snap({}, { "anime.settings": ["{}", T("10:00")] });
    const p = planPush(s, local({}, { "anime.settings": '{"gems":1}', "anime.friends": '[{"name":"M","ratings":{}}]' }), {}, { "anime.settings": T("11:00") }, NOW);
    expect(p.blocks).toEqual([
      { name: "anime.settings", value: '{"gems":1}', at: T("11:00") },
      { name: "anime.friends", value: '[{"name":"M","ratings":{}}]', at: NOW },
    ]);
  });
});

describe("untouched blocks don't claim the account", () => {
  // A phone that never changed its settings must not put "{}" into a new account: the PC signing in next would
  // then find the account "has settings" and lose its own.
  it("planPush skips a default block the account doesn't have yet", () => {
    expect(planPush(emptySnapshot(), local({}, { "anime.settings": "{}", "anime.friends": "[]" }), {}, {}, NOW).blocks).toEqual([]);
  });

  it("… but sends going back to the defaults when the account has the block", () => {
    const s = snap({}, { "anime.settings": ['{"gems":1}', T("10:00")] });
    expect(planPush(s, local({}, { "anime.settings": "{}" }), {}, {}, NOW).blocks).toEqual([{ name: "anime.settings", value: "{}", at: NOW }]);
  });

  it("addChoice skips default blocks too", () => {
    expect(addChoice(local({}, { "games.settings": "{}", "anime.friends": "[]" }), { items: [], blocks: [] }, NOW).blocks).toEqual([]);
  });
});

describe("applyPull", () => {
  it("a server removal deletes the local row; a server row overwrites the local one", () => {
    const l = local({ "games|steam:730": ["liked", T("10:00")], "games|steam:570": ["okay", T("10:00")] });
    const out = applyPull(l, { items: [row("games|steam:730", null, T("10:05")), row("games|steam:570", "loved", T("10:06"))], blocks: [] }, new Set());
    expect(out.items).toEqual(new Map([["games|steam:570", { rating: "loved", at: T("10:06") }]]));
  });

  it("a block from the server replaces the local one", () => {
    const out = applyPull(local({}, { "games.settings": "{}" }), { items: [], blocks: [{ name: "games.settings", value: '{"store":"jp"}', at: T("10:00") }] }, new Set());
    expect(out.blocks.get("games.settings")).toBe('{"store":"jp"}');
  });

  it("a key changed locally while the sync ran is left alone (it goes next time)", () => {
    const l = local({ "games|steam:730": ["disliked", T("10:10")] }, { "games.settings": '{"a":1}' });
    const out = applyPull(
      l,
      { items: [row("games|steam:730", "liked", T("10:05"))], blocks: [{ name: "games.settings", value: "{}", at: T("10:00") }] },
      new Set(["games|steam:730", "games.settings"]),
    );
    expect(out.items.get("games|steam:730")?.rating).toBe("disliked");
    expect(out.blocks.get("games.settings")).toBe('{"a":1}');
  });

  it("doesn't change the maps it was given", () => {
    const l = local({ "games|steam:730": ["liked", T("10:00")] });
    applyPull(l, { items: [row("games|steam:730", null, T("10:05"))], blocks: [] }, new Set());
    expect(l.items.size).toBe(1);
  });
});

describe("nextSnapshot and settle", () => {
  it("the answer's rows go into the snapshot, removals as rating null", () => {
    const s = nextSnapshot(snap({ "games|steam:730": ["liked", T("10:00")] }, {}, 1), { items: [row("games|steam:730", null, T("10:05"))], blocks: [{ name: "anime.friends", value: "[]", at: T("10:00") }] }, 2);
    expect(s).toEqual(snap({ "games|steam:730": [null, T("10:05")] }, { "anime.friends": ["[]", T("10:00")] }, 2));
  });

  it("a pushed row that lost (not in the answer) comes back as the account's copy", () => {
    const after = snap({ "games|steam:730": ["liked", T("10:00")] }, { "games.settings": ['{"store":"jp"}', T("10:00")] }, 3);
    const pushed = { items: [row("games|steam:730", "loved", T("09:00"))], blocks: [{ name: "games.settings" as const, value: "{}", at: T("09:00") }] };
    const answer: SyncAnswer = { rev: 3, items: [], blocks: [] };
    expect(settle(after, pushed, answer)).toEqual({
      items: [row("games|steam:730", "liked", T("10:00"))],
      blocks: [{ name: "games.settings", value: '{"store":"jp"}', at: T("10:00") }],
    });
  });
});

describe("firstSignIn", () => {
  const three = local({ "games|steam:1": ["liked", T("10:00")], "games|steam:2": ["okay", T("10:00")], "anime|mal:3": ["loved", T("10:00")] });

  it("an empty account → upload", () => {
    expect(firstSignIn(three, { items: [], blocks: [] })).toEqual({ kind: "upload" });
    expect(firstSignIn(three, { items: [row("games|steam:9", null, T("10:00"))], blocks: [] })).toEqual({ kind: "upload" });
  });

  it("an account with the same 3 ratings → same", () => {
    const account = [row("games|steam:1", "liked", T("09:00")), row("games|steam:2", "okay", T("09:00")), row("anime|mal:3", "loved", T("09:00"))];
    expect(firstSignIn(three, { items: account, blocks: [] })).toEqual({ kind: "same" });
  });

  it("12 local ratings the account doesn't have → ask, missing 12", () => {
    const twelve = local(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`games|steam:${i + 1}`, ["liked", T("10:00")]])));
    expect(firstSignIn(twelve, { items: [row("games|steam:99", "liked", T("10:00"))], blocks: [] })).toEqual({ kind: "ask", missing: 12 });
  });

  it("a different rating on the same item counts as missing; one the account removed too", () => {
    const account = [row("games|steam:1", "disliked", T("09:00")), row("games|steam:2", null, T("09:00")), row("anime|mal:3", "loved", T("09:00"))];
    expect(firstSignIn(three, { items: account, blocks: [] })).toEqual({ kind: "ask", missing: 2 });
  });
});

describe("addChoice", () => {
  const mine = local({ "games|steam:1": ["liked", T("10:00")] }, { "anime.settings": '{"gems":1}', "anime.friends": '[{"name":"M","ratings":{}}]' });

  it("sends every local rating with its date", () => {
    expect(addChoice(mine, { items: [], blocks: [] }, NOW).items).toEqual([row("games|steam:1", "liked", T("10:00"))]);
  });

  it("an account with a block keeps it: that block isn't sent", () => {
    const p = addChoice(mine, { items: [], blocks: [{ name: "anime.settings", value: "{}", at: T("09:00") }] }, NOW);
    expect(p.blocks.map((b) => b.name)).toEqual(["anime.friends"]);
  });

  it("an account without blocks gets the browser's", () => {
    const p = addChoice(mine, { items: [], blocks: [] }, NOW);
    expect(p.blocks).toEqual([
      { name: "anime.settings", value: '{"gems":1}', at: NOW },
      { name: "anime.friends", value: '[{"name":"M","ratings":{}}]', at: NOW },
    ]);
  });
});

describe("a removal racing a re-rating on another device (round trip)", () => {
  // A tiny stand-in for the server's merge (worker/src/sync.ts): newer `at` wins, ties keep the server's
  function server() {
    const rows = new Map<string, SyncItem & { rev: number }>();
    let rev = 0;
    return (since: number, items: SyncItem[]): SyncAnswer => {
      const winners = items.filter((i) => {
        const had = rows.get(`${i.section}|${i.item}`);
        return !had || i.at > had.at;
      });
      if (winners.length) rev++;
      for (const w of winners) rows.set(`${w.section}|${w.item}`, { ...w, rev });
      return { rev, items: [...rows.values()].filter((r) => r.rev > since).map(({ rev: _r, ...r }) => r), blocks: [] };
    };
  }

  it("A removes at 10:05, B had rated at 10:00 and never pushed → B ends up without it", () => {
    const sync = server();
    // Both devices agreed on nothing yet; A rated at 09:00 and synced
    let aSnap = emptySnapshot();
    let a = local({ "games|steam:730": ["okay", T("09:00")] });
    let answer = sync(aSnap.rev, planPush(aSnap, a, {}, {}, NOW).items);
    aSnap = nextSnapshot(aSnap, answer, answer.rev);
    // A removes it at 10:05 and syncs
    a = local();
    answer = sync(aSnap.rev, planPush(aSnap, a, { "games|steam:730": T("10:05") }, {}, NOW).items);
    aSnap = nextSnapshot(aSnap, answer, answer.rev);
    // B (offline since before) liked it at 10:00 and now syncs
    let bSnap = emptySnapshot();
    let b = local({ "games|steam:730": ["liked", T("10:00")] });
    const push = planPush(bSnap, b, {}, {}, NOW);
    expect(push.items).toEqual([row("games|steam:730", "liked", T("10:00"))]);
    answer = sync(bSnap.rev, push.items);
    bSnap = nextSnapshot(bSnap, answer, answer.rev);
    b = applyPull(b, settle(bSnap, push, answer), new Set());
    expect(b.items.has("games|steam:730")).toBe(false);
    expect(bSnap.items["games|steam:730"]).toEqual({ rating: null, at: T("10:05") });
  });

  it("and the other way: a rating at 10:05 beats a removal at 10:00", () => {
    const sync = server();
    sync(0, [row("games|steam:730", null, T("10:00"))]);
    const b = local({ "games|steam:730": ["liked", T("10:05")] });
    const push = planPush(emptySnapshot(), b, {}, {}, NOW);
    const answer = sync(0, push.items);
    const after = applyPull(b, settle(nextSnapshot(emptySnapshot(), answer, answer.rev), push, answer), new Set());
    expect(after.items.get("games|steam:730")).toEqual({ rating: "liked", at: T("10:05") });
  });
});

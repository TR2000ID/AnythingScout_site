// The sync runner, with a stand-in server, stand-in lists, storage and lock (no browser, no network).   npm test
import "./test-env"; // runner.ts brings in the real stores (for the real page): give them a stand-in browser first
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../../anime/state/createStore";
import { AccountError, type Api } from "./api";
import { ACCOUNT_KEY, PENDING_KEY, type AccountState } from "./account";
import { createRunner, type Deps, type Runner } from "./runner";
import type { BlockSection, RatingSection, RatingValue } from "./sections";
import type { Section, SyncAnswer, SyncBlock, SyncItem } from "./types";

// ---------- a stand-in server (the same merge rules as worker/src/sync.ts) ----------
function fakeServer() {
  const users = new Map<string, { rev: number; items: Map<string, SyncItem & { rev: number }>; blocks: Map<string, SyncBlock & { rev: number }> }>();
  const tokens = new Map<string, string>();
  let n = 0;
  const pushes: { items: SyncItem[]; blocks: SyncBlock[] }[] = [];
  const control = { fail: null as null | AccountError, failOnce: null as null | AccountError, tooBig: null as null | string };
  const session = (name: string) => {
    const token = `t${++n}`;
    tokens.set(token, name);
    return { name, token };
  };
  const user = (token: string) => {
    const name = tokens.get(token);
    if (!name) throw new AccountError("signed_out");
    return users.get(name)!;
  };
  const api: Api = {
    async createAccount(name) {
      if (users.has(name)) throw new AccountError("taken");
      users.set(name, { rev: 0, items: new Map(), blocks: new Map() });
      return session(name);
    },
    async signIn(name) {
      if (!users.has(name)) throw new AccountError("unknown");
      return session(name);
    },
    async signOut(token) {
      tokens.delete(token);
    },
    async me(token) {
      const u = user(token);
      return { name: tokens.get(token)!, pictureAt: null, empty: u.items.size === 0 && u.blocks.size === 0 };
    },
    async sync(token, body) {
      if (control.failOnce) {
        const e = control.failOnce;
        control.failOnce = null;
        throw e;
      }
      if (control.fail) throw control.fail;
      const u = user(token);
      const big = body.blocks.find((b) => b.name === control.tooBig);
      if (big) throw new AccountError("too_big", big.name);
      pushes.push({ items: body.items, blocks: body.blocks });
      const iw = body.items.filter((i) => !(u.items.get(`${i.section}|${i.item}`)?.at! >= i.at));
      const bw = body.blocks.filter((b) => !(u.blocks.get(b.name)?.at! >= b.at));
      if (iw.length || bw.length) u.rev++;
      for (const i of iw) u.items.set(`${i.section}|${i.item}`, { ...i, rev: u.rev });
      for (const b of bw) u.blocks.set(b.name, { ...b, rev: u.rev });
      const strip = <T extends { rev: number }>({ rev: _r, ...rest }: T) => rest;
      const reset = body.rev > u.rev;
      const since = reset ? 0 : body.rev;
      return {
        rev: u.rev,
        items: [...u.items.values()].filter((i) => i.rev > since).map(strip) as SyncItem[],
        blocks: [...u.blocks.values()].filter((b) => b.rev > since).map(strip) as SyncBlock[],
        ...(reset ? { reset: true as const } : {}),
      } satisfies SyncAnswer;
    },
    async putPicture() {},
    async deletePicture() {},
  };
  const held = (name: string) => users.get(name)!;
  /** D1 Time Travel: the account goes back to an earlier state (its rev goes down) */
  const restore = (name: string, rev: number, keep: (key: string) => boolean) => {
    const u = users.get(name)!;
    u.rev = rev;
    for (const key of [...u.items.keys()]) if (!keep(key)) u.items.delete(key);
  };
  return { api, pushes, control, held, restore };
}

// ---------- stand-in lists, shared like localStorage is between tabs ----------
function fakeBrowser() {
  const data: Record<Section, Map<string, RatingValue>> = { anime: new Map(), games: new Map() };
  const blockData: Record<string, string> = { "anime.settings": "{}", "games.settings": "{}", "anime.friends": "[]" };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  const ratings: RatingSection[] = (["anime", "games"] as const).map((section) => ({
    section,
    get: () => new Map(data[section]),
    replace: (rows) => {
      data[section] = new Map(rows);
      notify();
    },
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  }));
  const blocks: BlockSection[] = (["anime.settings", "games.settings", "anime.friends"] as const).map((name) => ({
    name,
    get: () => blockData[name],
    replace: (value) => {
      blockData[name] = value;
      notify();
    },
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  }));
  const memory = new Map<string, string>();
  const storage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
  const rate = (section: Section, item: string, rating: string | null, at = new Date().toISOString()) => {
    const next = new Map(data[section]);
    if (rating) next.set(item, { rating, at });
    else next.delete(item);
    data[section] = next;
    notify();
  };
  const setBlock = (name: string, value: string) => {
    blockData[name] = value;
    notify();
  };
  return { data, blockData, ratings, blocks, storage, memory, rate, setBlock };
}

function makeLock() {
  let chain = Promise.resolve();
  return (fn: () => Promise<void>) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };
}

type Browser = ReturnType<typeof fakeBrowser>;
type Server = ReturnType<typeof fakeServer>;

function runnerFor(browser: Browser, server: Server, lock = makeLock()) {
  const events = new Map<string, () => void>();
  const store = createStore<AccountState>({ state: "signed_out" });
  let clock = Date.parse("2026-11-15T12:00:00.000Z");
  const deps: Deps = {
    api: server.api,
    now: () => new Date(clock++).toISOString(),
    lock,
    storage: browser.storage,
    ratings: browser.ratings,
    blocks: browser.blocks,
    store,
    on: (type, fn) => void events.set(type, fn),
  };
  const runner = createRunner(deps);
  return { runner, store, fire: (type: string) => events.get(type)?.(), deps };
}

const record = (b: Browser) => JSON.parse(b.storage.getItem(ACCOUNT_KEY) ?? "null");
const pending = (b: Browser) => JSON.parse(b.storage.getItem(PENDING_KEY) ?? "null");
const at = (hhmm: string) => `2026-11-15T${hhmm}:00.000Z`;

let browser: Browser;
let server: Server;
let r: ReturnType<typeof runnerFor>;
let runner: Runner;

beforeEach(() => {
  browser = fakeBrowser();
  server = fakeServer();
  r = runnerFor(browser, server);
  runner = r.runner;
});

afterEach(() => {
  runner.stop();
  vi.useRealTimers();
});

describe("signing in", () => {
  it("an empty account takes this browser's 3 ratings; the snapshot holds them", async () => {
    browser.rate("games", "steam:1", "liked", at("10:00"));
    browser.rate("games", "steam:2", "okay", at("10:00"));
    browser.rate("anime", "mal:3", "loved", at("10:00"));
    expect(await runner.signInFlow("Ken", "create")).toEqual({ kind: "done" });
    expect(server.held("Ken").items.size).toBe(3);
    expect(Object.keys(record(browser).snapshot.items)).toHaveLength(3);
    expect(r.store.get()).toMatchObject({ state: "signed_in", name: "Ken", status: "ok" });
  });

  it("an account with 2 others while this browser has 3 → asks about 3; Leave them out, then sign out puts them back", async () => {
    await server.api.createAccount("Ken");
    const { token } = await server.api.signIn("Ken");
    await server.api.sync(token, { rev: 0, items: [{ section: "games", item: "steam:8", rating: "liked", at: at("09:00") }, { section: "games", item: "steam:9", rating: "okay", at: at("09:00") }], blocks: [] });
    for (const i of [1, 2, 3]) browser.rate("games", `steam:${i}`, "liked", at("10:00"));

    const step = await runner.signInFlow("Ken", "signin");
    expect(step).toMatchObject({ kind: "ask", missing: 3 });
    if (step.kind !== "ask") throw new Error();
    await step.resolve("leave");
    expect([...browser.data.games.keys()].sort()).toEqual(["steam:8", "steam:9"]);
    expect(Object.keys(record(browser).stash.ratings.games).sort()).toEqual(["steam:1", "steam:2", "steam:3"]);
    expect(server.held("Ken").items.size).toBe(2); // nothing of this browser's went up

    expect(await runner.signOutFlow()).toEqual({ kind: "done" });
    expect([...browser.data.games.keys()].sort()).toEqual(["steam:1", "steam:2", "steam:3"]);
    expect(browser.storage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(r.store.get()).toEqual({ state: "signed_out" });
  });

  it("… or Add them to your account: the 3 go up and the browser has all 5", async () => {
    await server.api.createAccount("Ken");
    const { token } = await server.api.signIn("Ken");
    await server.api.sync(token, { rev: 0, items: [{ section: "games", item: "steam:8", rating: "liked", at: at("09:00") }, { section: "games", item: "steam:9", rating: "okay", at: at("09:00") }], blocks: [] });
    for (const i of [1, 2, 3]) browser.rate("games", `steam:${i}`, "liked", at("10:00"));
    const step = await runner.signInFlow("Ken", "signin");
    if (step.kind !== "ask") throw new Error();
    server.pushes.length = 0;
    await step.resolve("add");
    expect(server.pushes[0].items).toHaveLength(3);
    expect(browser.data.games.size).toBe(5);
    expect(server.held("Ken").items.size).toBe(5);
  });

  it("signing out of a browser that had nothing before leaves nothing of the account", async () => {
    await runner.signInFlow("Ken", "create");
    browser.rate("games", "steam:1", "liked");
    await runner.syncNow();
    expect(await runner.signOutFlow()).toEqual({ kind: "done" });
    expect(browser.data.games.size).toBe(0);
    expect(server.held("Ken").items.size).toBe(1);
  });

  it("server errors reach the caller with their code", async () => {
    await expect(runner.signInFlow("Nobody", "signin")).rejects.toMatchObject({ code: "unknown" });
    expect(r.store.get()).toEqual({ state: "signed_out" });
  });
});

describe("syncing", () => {
  it("a change syncs once, 3 seconds after the last change", async () => {
    await runner.signInFlow("Ken", "create");
    runner.start();
    await vi.waitFor(() => expect(server.pushes.length).toBeGreaterThan(0)); // the start-up sync
    await runner.idle();
    vi.useFakeTimers();
    server.pushes.length = 0;
    browser.rate("games", "steam:1", "liked");
    await vi.advanceTimersByTimeAsync(1000);
    browser.rate("games", "steam:2", "liked");
    await vi.advanceTimersByTimeAsync(2900);
    expect(server.pushes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    vi.useRealTimers();
    await runner.idle();
    expect(server.pushes).toHaveLength(1);
    expect(server.pushes[0].items.map((i) => i.item).sort()).toEqual(["steam:1", "steam:2"]);
  });

  it("removing a rating sends a removal dated when it was removed", async () => {
    browser.rate("games", "steam:1", "liked", at("10:00"));
    await runner.signInFlow("Ken", "create");
    runner.start();
    await runner.idle();
    browser.rate("games", "steam:1", null);
    const removedAt = pending(browser).removedAt["games|steam:1"];
    expect(removedAt).toMatch(/^2026-11-15T12:/);
    await runner.syncNow();
    expect(server.held("Ken").items.get("games|steam:1")).toMatchObject({ rating: null, at: removedAt });
    expect(pending(browser).removedAt).toEqual({});
  });

  it("another device's change arrives on the next sync", async () => {
    await runner.signInFlow("Ken", "create");
    const other = await server.api.signIn("Ken");
    await server.api.sync(other.token, { rev: 0, items: [{ section: "anime", item: "mal:7", rating: "loved", at: at("11:00") }], blocks: [{ name: "anime.settings", value: '{"gems":1}', at: at("11:00") }] });
    await runner.syncNow();
    expect(browser.data.anime.get("mal:7")).toEqual({ rating: "loved", at: at("11:00") });
    expect(browser.blockData["anime.settings"]).toBe('{"gems":1}');
    expect(r.store.get()).toMatchObject({ synced: expect.any(String) });
  });

  it("a session that's gone (401) → ended; the lists stay as they are", async () => {
    browser.rate("games", "steam:1", "liked");
    await runner.signInFlow("Ken", "create");
    server.control.fail = new AccountError("signed_out");
    browser.rate("games", "steam:2", "liked");
    await runner.syncNow();
    expect(r.store.get()).toEqual({ state: "ended", message: "signed_out" });
    expect([...browser.data.games.keys()].sort()).toEqual(["steam:1", "steam:2"]);
    // and it stops syncing
    server.control.fail = null;
    server.pushes.length = 0;
    await runner.syncNow();
    expect(server.pushes).toHaveLength(0);
  });

  it("the server refuses or has a problem → status problem (not offline); the next trigger tries again", async () => {
    await runner.signInFlow("Ken", "create");
    runner.start();
    await runner.idle();
    server.control.fail = new AccountError("server"); // a 400 bad_sync or a 500: the connection is fine
    browser.rate("games", "steam:1", "liked");
    await runner.syncNow();
    expect(r.store.get()).toMatchObject({ status: "problem" });
    server.control.fail = null;
    r.fire("visible");
    await vi.waitFor(() => expect(server.held("Ken").items.size).toBe(1));
    await runner.idle();
    expect(r.store.get()).toMatchObject({ status: "ok" });
  });

  it("offline → status offline; the next online event syncs", async () => {
    await runner.signInFlow("Ken", "create");
    runner.start();
    await runner.idle();
    server.control.fail = new AccountError("offline");
    browser.rate("games", "steam:1", "liked");
    await runner.syncNow();
    expect(r.store.get()).toMatchObject({ status: "offline" });
    server.control.fail = null;
    r.fire("online");
    await vi.waitFor(() => expect(server.held("Ken").items.size).toBe(1));
    await runner.idle();
    expect(r.store.get()).toMatchObject({ status: "ok" });
  });

  it("a Watch together list too big to sync → status too_big; the list stays here, the rest still syncs", async () => {
    await runner.signInFlow("Ken", "create");
    server.control.tooBig = "anime.friends";
    browser.setBlock("anime.friends", '[{"name":"Mika","ratings":{}}]');
    browser.rate("games", "steam:1", "liked");
    await runner.syncNow();
    expect(r.store.get()).toMatchObject({ status: "too_big" });
    expect(browser.blockData["anime.friends"]).toBe('[{"name":"Mika","ratings":{}}]');
    expect(server.held("Ken").items.size).toBe(1);
  });

  it("more than 5,000 changes go up in parts", async () => {
    await runner.signInFlow("Ken", "create");
    browser.ratings[0].replace(new Map(Array.from({ length: 6000 }, (_, i) => [`mal:${i}`, { rating: "liked", at: at("10:00") }])));
    server.pushes.length = 0;
    await runner.syncNow();
    expect(server.pushes.map((p) => p.items.length)).toEqual([5000, 1000]);
    expect(server.held("Ken").items.size).toBe(6000);
  });
});

describe("blocked storage (private window)", () => {
  it("reading the account fails → signed out; signing in says no_storage", async () => {
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    const store = createStore<AccountState>({ state: "signed_out" });
    const blocked = createRunner({ ...r.deps, storage: throwing, store });
    blocked.start();
    expect(store.get()).toEqual({ state: "signed_out" });
    await expect(blocked.signInFlow("Ken", "create")).rejects.toMatchObject({ code: "no_storage" });
    blocked.stop();
  });
});

describe("two tabs of one browser", () => {
  it("both sync at once: the server gets both new ratings and neither snapshot loses the other's", async () => {
    await runner.signInFlow("Ken", "create");
    const lock = makeLock();
    const tabA = runnerFor(browser, server, lock);
    const tabB = runnerFor(browser, server, lock);
    tabA.runner.start();
    tabB.runner.start();
    await Promise.all([tabA.runner.idle(), tabB.runner.idle()]);
    browser.rate("games", "steam:1", "liked");
    browser.rate("games", "steam:2", "loved");
    await Promise.all([tabA.runner.syncNow(), tabB.runner.syncNow()]);
    expect([...server.held("Ken").items.keys()].sort()).toEqual(["games|steam:1", "games|steam:2"]);
    expect(Object.keys(record(browser).snapshot.items).sort()).toEqual(["games|steam:1", "games|steam:2"]);
    expect(browser.data.games.size).toBe(2);
    tabA.runner.stop();
    tabB.runner.stop();
  });

  it("a tab that signs in is seen by the other tab", async () => {
    const tabB = runnerFor(browser, server);
    tabB.runner.start();
    await runner.signInFlow("Ken", "create");
    tabB.fire("storage");
    expect(tabB.store.get()).toMatchObject({ state: "signed_in", name: "Ken" });
    tabB.runner.stop();
  });
});

describe("signing out with changes not yet sent", () => {
  it("offline with one unsent change → unsynced 1; force() signs out anyway", async () => {
    await runner.signInFlow("Ken", "create");
    server.control.fail = new AccountError("offline");
    browser.rate("games", "steam:1", "liked");
    const step = await runner.signOutFlow();
    expect(step).toMatchObject({ kind: "unsynced", count: 1 });
    if (step.kind !== "unsynced") throw new Error();
    await step.force();
    expect(browser.storage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(r.store.get()).toEqual({ state: "signed_out" });
    expect(browser.data.games.size).toBe(0);
  });
});

describe("review fixes", () => {
  it("Leave them out: if this browser can't save the sign-in, the friend's lists stay as they were", async () => {
    await server.api.createAccount("Ken");
    const { token } = await server.api.signIn("Ken");
    await server.api.sync(token, { rev: 0, items: [{ section: "games", item: "steam:8", rating: "liked", at: at("09:00") }], blocks: [] });
    for (const i of [1, 2, 3]) browser.rate("games", `steam:${i}`, "liked", at("10:00"));
    const step = await runner.signInFlow("Ken", "signin");
    if (step.kind !== "ask") throw new Error();
    const setItem = browser.storage.setItem;
    browser.storage.setItem = (k, v) => {
      if (k === ACCOUNT_KEY) throw new Error("quota");
      setItem(k, v);
    };
    await expect(step.resolve("leave")).rejects.toMatchObject({ code: "no_storage" });
    expect([...browser.data.games.keys()].sort()).toEqual(["steam:1", "steam:2", "steam:3"]);
    expect(r.store.get()).toEqual({ state: "signed_out" });
  });

  it("sign-out puts back what this browser had before signing in, on every path (not only Leave them out)", async () => {
    for (const i of [1, 2, 3]) browser.rate("games", `steam:${i}`, "liked", at("10:00"));
    browser.setBlock("anime.friends", '[{"name":"Mika","ratings":{}}]');
    await runner.signInFlow("Ken", "create"); // a new account: uploads, nothing asked
    browser.rate("games", "steam:4", "loved");
    await runner.syncNow();
    expect(await runner.signOutFlow()).toEqual({ kind: "done" });
    expect([...browser.data.games.keys()].sort()).toEqual(["steam:1", "steam:2", "steam:3"]);
    expect(browser.blockData["anime.friends"]).toBe('[{"name":"Mika","ratings":{}}]');
    expect(server.held("Ken").items.size).toBe(4); // the account keeps everything
  });

  it("a change here never rewrites the sign-in record outside a sync, and writes nothing once signed out", async () => {
    await runner.signInFlow("Ken", "create");
    runner.start();
    await runner.idle();
    const written: string[] = [];
    const setItem = browser.storage.setItem;
    browser.storage.setItem = (k, v) => {
      written.push(k);
      setItem(k, v);
    };
    browser.rate("games", "steam:1", "liked");
    browser.rate("games", "steam:1", null);
    expect(written).not.toContain(ACCOUNT_KEY);
    // another tab signed out a moment ago: this tab hears the lists change afterwards
    browser.storage.removeItem(ACCOUNT_KEY);
    for (const k of [...browser.memory.keys()]) if (k.startsWith(ACCOUNT_KEY)) browser.memory.delete(k);
    written.length = 0;
    browser.rate("games", "steam:2", "liked");
    expect(written).toEqual([]);
  });

  it("after a Time Travel restore the device starts over from the account, and its own ratings go up again", async () => {
    await runner.signInFlow("Ken", "create");
    browser.rate("games", "steam:1", "liked", at("10:00"));
    await runner.syncNow(); // rev 1
    browser.rate("games", "steam:9", "liked", at("10:30"));
    await runner.syncNow(); // rev 2
    server.restore("Ken", 1, (key) => key === "games|steam:1");
    await runner.syncNow(); // the account answers "reset": everything it holds
    expect(record(browser).snapshot.rev).toBe(1);
    await runner.syncNow();
    expect([...server.held("Ken").items.keys()].sort()).toEqual(["games|steam:1", "games|steam:9"]);
    expect([...browser.data.games.keys()].sort()).toEqual(["steam:1", "steam:9"]);
  });
});

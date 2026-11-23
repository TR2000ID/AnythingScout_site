// The sync runner: keeps this browser's lists and the account in step.
// The lists stay in the browser exactly as before (the site works offline and signed out); this watches them,
// remembers when something was removed or changed, and syncs: on load, 3 seconds after the last change, when
// the tab comes back into view, and when the browser is back online.
// Every sync runs inside one lock shared by all tabs of this browser, and re-reads the saved record inside it,
// so two tabs never send the same change twice or overwrite each other's snapshot.
import type { Store } from "../../anime/state/createStore";
import {
  ACCOUNT_KEY,
  accountStore,
  readPending,
  readRecord,
  removeRecord,
  storageWorks,
  writePending,
  writeRecord,
  type AccountRecord,
  type AccountState,
  type StorageLike,
  type SyncStatus,
} from "./account";
import { AccountError, realApi, type Api } from "./api";
import { addChoice, applyPull, emptySnapshot, firstSignIn, keyOf, nextSnapshot, planPush, settle, type Changes, type Local, type Snapshot } from "./engine";
import { BLOCK_SECTIONS, clearLocal, RATING_SECTIONS, restoreLocal, snapshotLocal, type BlockSection, type LocalSnapshot, type RatingSection } from "./sections";
import type { SyncAnswer } from "./types";

export const DEBOUNCE_MS = 3000;
const MAX_ITEMS_PER_SYNC = 5000; // the server's limit per request; more go up in parts

export interface Deps {
  api: Api;
  now: () => string;
  lock: (fn: () => Promise<void>) => Promise<void>;
  storage: StorageLike;
  ratings: RatingSection[];
  blocks: BlockSection[];
  store: Store<AccountState>;
  /** Listen for "online", "visible" (the tab came back into view) or "storage" (another tab changed the
   *  sign-in). May return a function that stops listening. */
  on: (type: "online" | "visible" | "storage", fn: () => void) => void | (() => void);
}

export type SignInStep = { kind: "done" } | { kind: "ask"; missing: number; resolve(choice: "add" | "leave"): Promise<void> };
export type SignOutStep = { kind: "done" } | { kind: "unsynced"; count: number; force(): Promise<void> };

export interface Runner {
  start(): void;
  stop(): void;
  syncNow(): Promise<void>;
  /** Resolves once the sync running now (if any) has finished */
  idle(): Promise<void>;
  signInFlow(name: string, mode: "create" | "signin"): Promise<SignInStep>;
  signOutFlow(): Promise<SignOutStep>;
  /** "You were signed out" → OK: back to signed out (a set-aside list comes back) */
  dismissEnded(): void;
  setPicture(picture: Blob): Promise<void>;
  removePicture(): Promise<void>;
}

const sameRows = (a: Map<string, { rating: string; at: string }>, b: Map<string, { rating: string; at: string }>) =>
  a.size === b.size && [...a].every(([k, v]) => b.get(k)?.rating === v.rating && b.get(k)?.at === v.at);

export function createRunner(deps: Deps): Runner {
  const { api, now, lock, storage, ratings, blocks, store } = deps;
  let applying = false; // the runner is writing the lists itself: those changes aren't "made here"
  let status: SyncStatus = "ok";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> = Promise.resolve();
  let stops: (() => void)[] = [];
  const tooBig = new Map<string, string>(); // block name → the value the server refused (not sent again until it changes)
  // What the lists looked like at the last look, to tell which rows a change removed
  const seenRatings = new Map<string, Map<string, { rating: string; at: string }>>();
  const seenBlocks = new Map<string, string>();

  // ---------- reading and writing the lists ----------

  function readLocal(): Local {
    const items = new Map<string, { rating: string; at: string }>();
    for (const r of ratings) for (const [item, row] of r.get()) items.set(keyOf(r.section, item), row);
    return { items, blocks: new Map(blocks.map((b) => [b.name, b.get()])) };
  }

  function rememberLists() {
    for (const r of ratings) seenRatings.set(r.section, r.get());
    for (const b of blocks) seenBlocks.set(b.name, b.get());
  }

  /** Put these lists in place, touching only what differs (each write redraws and tells the other tabs) */
  function applyLocal(target: Local) {
    applying = true;
    try {
      for (const r of ratings) {
        const rows = new Map<string, { rating: string; at: string }>();
        const prefix = `${r.section}|`;
        for (const [key, row] of target.items) if (key.startsWith(prefix)) rows.set(key.slice(prefix.length), row);
        if (!sameRows(rows, r.get())) r.replace(rows);
      }
      for (const b of blocks) {
        const value = target.blocks.get(b.name);
        if (value !== undefined && value !== b.get()) b.replace(value);
      }
    } finally {
      applying = false;
      rememberLists();
    }
  }

  /** The snapshot with each block as this device would read it (see BlockSection.normalize) */
  function forPlanning(snap: Snapshot): Snapshot {
    const out: Snapshot = { ...snap, blocks: { ...snap.blocks } };
    for (const b of blocks) {
      const held = out.blocks[b.name];
      if (held && b.normalize) out.blocks[b.name] = { ...held, value: b.normalize(held.value) };
    }
    return out;
  }

  // ---------- state ----------

  function stateFrom(record: AccountRecord | null): AccountState {
    if (!record) return { state: "signed_out" };
    if (!record.token) return { state: "ended", message: "signed_out" };
    return { state: "signed_in", name: record.name, token: record.token, pictureAt: record.pictureAt, synced: record.synced, status };
  }

  const refreshState = () => store.set(stateFrom(readRecord(storage)));

  function setStatus(next: SyncStatus) {
    status = next;
    refreshState();
  }

  /** The server says this session is gone: stop syncing, keep every list as it is */
  function endSession() {
    const record = readRecord(storage);
    if (record) writeRecord(storage, { ...record, token: null });
    refreshState();
  }

  // ---------- noticing changes made here ----------

  function onRatingsChanged(section: RatingSection) {
    const now_ = section.get();
    const before = seenRatings.get(section.section) ?? new Map();
    seenRatings.set(section.section, now_);
    if (applying || !readRecord(storage)?.token) return;
    const pending = readPending(storage);
    const at = now();
    let changed = false;
    for (const item of before.keys()) {
      const key = keyOf(section.section, item);
      if (!now_.has(item) && !pending.removedAt[key]) {
        pending.removedAt[key] = at; // another tab may have noted it first, with its own time: keep that one
        changed = true;
      }
    }
    for (const item of now_.keys()) {
      const key = keyOf(section.section, item);
      if (pending.removedAt[key]) {
        delete pending.removedAt[key];
        changed = true;
      }
    }
    if (changed) writePending(storage, pending);
    schedule();
  }

  function onBlockChanged(block: BlockSection) {
    const value = block.get();
    const before = seenBlocks.get(block.name);
    seenBlocks.set(block.name, value);
    if (applying || value === before || !readRecord(storage)?.token) return;
    const pending = readPending(storage);
    pending.blockAt[block.name] = now();
    writePending(storage, pending);
    schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncNow();
    }, DEBOUNCE_MS);
  }

  // ---------- talking to the server ----------

  /** Send changes (in parts if there are many) and collect every answer. A block the server finds too big is
   *  left out and the rest is sent again, so ratings and the other blocks still sync. */
  async function pushParts(token: string, start: Snapshot, changes: Changes) {
    let snap = start;
    const got: Changes = { items: [], blocks: [] };
    const sent: Changes = { items: [], blocks: [] };
    const parts: Changes["items"][] = [];
    for (let i = 0; i < changes.items.length; i += MAX_ITEMS_PER_SYNC) parts.push(changes.items.slice(i, i + MAX_ITEMS_PER_SYNC));
    if (!parts.length) parts.push([]);
    let pendingBlocks = changes.blocks.filter((b) => tooBig.get(b.name) !== b.value);
    let refused = pendingBlocks.length < changes.blocks.length;
    for (const items of parts) {
      let answer: SyncAnswer;
      for (;;) {
        try {
          answer = await api.sync(token, { rev: snap.rev, items, blocks: pendingBlocks });
          break;
        } catch (err) {
          const big = err instanceof AccountError && err.code === "too_big" ? pendingBlocks.find((b) => b.name === err.blockName) : undefined;
          if (!big) throw err;
          tooBig.set(big.name, big.value);
          pendingBlocks = pendingBlocks.filter((b) => b !== big);
          refused = true;
        }
      }
      sent.items.push(...items);
      sent.blocks.push(...pendingBlocks);
      got.items.push(...answer.items);
      got.blocks.push(...answer.blocks);
      // A rolled-back account answers with everything it holds: start the snapshot over from that
      snap = nextSnapshot(answer.reset ? emptySnapshot() : snap, answer, answer.rev);
      pendingBlocks = [];
    }
    return { snap, got, sent, refused };
  }

  /** What changed in the lists between two looks (those keys were changed here while a sync was running) */
  function changedBetween(a: Local, b: Local): Set<string> {
    const out = new Set<string>();
    for (const [k, v] of a.items) if (b.items.get(k)?.rating !== v.rating || b.items.get(k)?.at !== v.at) out.add(k);
    for (const k of b.items.keys()) if (!a.items.has(k)) out.add(k);
    for (const [k, v] of a.blocks) if (b.blocks.get(k) !== v) out.add(k);
    return out;
  }

  async function runSync() {
    const record = readRecord(storage); // read inside the lock: another tab may have just synced
    if (!record?.token) {
      refreshState();
      return;
    }
    const token = record.token;
    const local = readLocal();
    const pending = readPending(storage);
    const plan = planPush(forPlanning(record.snapshot), local, pending.removedAt, pending.blockAt, now());
    let result: Awaited<ReturnType<typeof pushParts>>;
    try {
      result = await pushParts(token, record.snapshot, plan);
    } catch (err) {
      const code = err instanceof AccountError ? err.code : "server";
      if (code === "signed_out") endSession();
      // No connection, or the server refused / had a problem (said as such, not as "offline"): either way,
      // try again on the next trigger
      else setStatus(code === "offline" ? "offline" : "problem");
      return;
    }
    const nowLocal = readLocal();
    const changed = changedBetween(local, nowLocal);
    applyLocal(applyPull(nowLocal, settle(result.snap, result.sent, result.got), changed));

    const latest = readRecord(storage);
    if (!latest || latest.token !== token) return; // signed out meanwhile (in another tab): leave it be
    writeRecord(storage, { ...latest, snapshot: result.snap, synced: now() });
    // What was noted before this sync has been sent; what changed while it ran goes next time
    const left = readPending(storage);
    for (const key of Object.keys(left.removedAt)) if (!changed.has(key)) delete left.removedAt[key];
    for (const name of Object.keys(left.blockAt)) if (!changed.has(name)) delete left.blockAt[name];
    writePending(storage, left);
    setStatus(result.refused ? "too_big" : "ok");
  }

  function syncNow(): Promise<void> {
    const run = lock(runSync).catch((err) => console.error("sync", err));
    inflight = run;
    return run;
  }

  // ---------- signing in and out ----------

  // In both: the sign-in (with this browser's set-aside lists) is saved BEFORE the lists change, so a closed tab,
  // a slow network or a full storage can never leave the lists replaced with nothing saved to bring them back.

  async function finishAdd(session: { name: string; token: string }, account: Changes, stash: LocalSnapshot) {
    const result = await pushParts(session.token, emptySnapshot(), addChoice(readLocal(), account, now()));
    await saveSignIn(session, result.snap, stash);
    applyLocal(applyPull(readLocal(), settle(result.snap, result.sent, result.got), new Set()));
    setStatus(result.refused ? "too_big" : "ok");
  }

  async function finishLeave(session: { name: string; token: string }, account: SyncAnswer, stash: LocalSnapshot) {
    await saveSignIn(session, nextSnapshot(emptySnapshot(), account, account.rev), stash);
    const fresh: Local = { items: new Map(), blocks: new Map(blocks.map((b) => [b.name, b.name === "anime.friends" ? "[]" : "{}"])) };
    applyLocal(applyPull(fresh, account, new Set()));
    setStatus("ok");
  }

  async function saveSignIn(session: { name: string; token: string }, snapshot: Snapshot, stash: LocalSnapshot) {
    const me = await api.me(session.token).catch(() => null);
    const record: AccountRecord = { name: session.name, token: session.token, pictureAt: me?.pictureAt ?? null, snapshot, stash, synced: now() };
    if (!writeRecord(storage, record)) throw new AccountError("no_storage");
    writePending(storage, { removedAt: {}, blockAt: {} });
  }

  async function signInFlow(name: string, mode: "create" | "signin"): Promise<SignInStep> {
    if (!storageWorks(storage)) throw new AccountError("no_storage");
    let step: SignInStep = { kind: "done" };
    await lock(async () => {
      const session = mode === "create" ? await api.createAccount(name) : await api.signIn(name);
      const account = await api.sync(session.token, { rev: 0, items: [], blocks: [] }); // look first, send nothing yet
      // What this browser had before signing in comes back on sign-out, whichever way the sign-in goes (a list
      // set aside by an earlier sign-in that ended with "You were signed out" stays the one to come back)
      const stash = readRecord(storage)?.stash ?? snapshotLocal(ratings, blocks);
      const decision = firstSignIn(readLocal(), account);
      tooBig.clear();
      if (decision.kind !== "ask") await finishAdd(session, account, stash);
      else
        step = {
          kind: "ask",
          missing: decision.missing,
          resolve: (choice) => lock(() => (choice === "add" ? finishAdd(session, account, stash) : finishLeave(session, account, stash))),
        };
    });
    return step;
  }

  function unsentCount(record: AccountRecord): number {
    const pending = readPending(storage);
    const p = planPush(forPlanning(record.snapshot), readLocal(), pending.removedAt, pending.blockAt, now());
    return p.items.length + p.blocks.length;
  }

  async function finishSignOut() {
    await lock(async () => {
      const record = readRecord(storage);
      if (record?.token) await api.signOut(record.token).catch(() => {}); // best effort: the browser forgets the token anyway
      applying = true;
      try {
        if (record?.stash) restoreLocal(record.stash, ratings, blocks);
        else clearLocal(ratings, blocks);
      } finally {
        applying = false;
        rememberLists();
      }
      removeRecord(storage);
      tooBig.clear();
      status = "ok";
      refreshState();
    });
  }

  async function signOutFlow(): Promise<SignOutStep> {
    const record = readRecord(storage);
    if (record?.token) {
      await syncNow(); // one last try first
      const latest = readRecord(storage);
      const count = latest?.token ? unsentCount(latest) : 0;
      if (count > 0) return { kind: "unsynced", count, force: finishSignOut };
    }
    await finishSignOut();
    return { kind: "done" };
  }

  function dismissEnded() {
    const record = readRecord(storage);
    if (record?.stash) {
      applying = true;
      try {
        restoreLocal(record.stash, ratings, blocks);
      } finally {
        applying = false;
        rememberLists();
      }
    }
    removeRecord(storage);
    refreshState();
  }

  async function changePicture(change: (token: string) => Promise<void>) {
    const record = readRecord(storage);
    if (!record?.token) throw new AccountError("signed_out");
    try {
      await change(record.token);
      const me = await api.me(record.token);
      const latest = readRecord(storage);
      if (latest) writeRecord(storage, { ...latest, pictureAt: me.pictureAt });
      refreshState();
    } catch (err) {
      if (err instanceof AccountError && err.code === "signed_out") endSession();
      throw err;
    }
  }

  return {
    start() {
      rememberLists();
      refreshState();
      for (const r of ratings) stops.push(r.subscribe(() => onRatingsChanged(r)));
      for (const b of blocks) stops.push(b.subscribe(() => onBlockChanged(b)));
      for (const type of ["online", "visible"] as const) {
        const stop = deps.on(type, () => void syncNow());
        if (stop) stops.push(stop);
      }
      const stop = deps.on("storage", refreshState);
      if (stop) stops.push(stop);
      if (readRecord(storage)?.token) void syncNow();
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      stops.forEach((s) => s());
      stops = [];
    },
    syncNow,
    idle: () => inflight,
    signInFlow,
    signOutFlow,
    dismissEnded,
    setPicture: (picture) => changePicture((token) => api.putPicture(token, picture)),
    removePicture: () => changePicture((token) => api.deletePicture(token)),
  };
}

// ---------- the real browser ----------

/** Tabs of one browser take turns (navigator.locks); without it, at least this tab's syncs take turns */
function browserLock(): Deps["lock"] {
  let chain = Promise.resolve();
  return (fn) => {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) return locks.request("anything-scout-sync", fn);
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };
}

/** localStorage, read only when used: in a blocked private window even touching it can throw */
const browserStorage: StorageLike = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

export function realDeps(): Deps {
  return {
    api: realApi,
    now: () => new Date().toISOString(),
    lock: browserLock(),
    storage: browserStorage,
    ratings: RATING_SECTIONS,
    blocks: BLOCK_SECTIONS,
    store: accountStore,
    on(type, fn) {
      if (type === "online") {
        window.addEventListener("online", fn);
        return () => window.removeEventListener("online", fn);
      }
      if (type === "visible") {
        const onVisible = () => document.visibilityState === "visible" && fn();
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
      }
      const onStorage = (e: StorageEvent) => (e.key === ACCOUNT_KEY || e.key === null) && fn();
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}

let current: Runner | null = null;

/** Start syncing for this page (main.tsx, once) */
export function startSync(deps: Deps = realDeps()): Runner {
  current?.stop();
  current = createRunner(deps);
  current.start();
  return current;
}

/** The page's runner, for the account button and the sign-in dialog */
export function runner(): Runner {
  if (!current) throw new Error("startSync() hasn't run");
  return current;
}

// The sync engine: plain functions, no stores, no network (runner.ts wires them up).
// The browser keeps a "snapshot": the last state it and the server agreed on. Comparing the lists with it
// tells what changed here (to send); the server's answer tells what changed elsewhere (to take in).
// Item keys are "section|item", like "games|steam:730".
import type { BlockName, Section, SyncAnswer, SyncBlock, SyncItem } from "./types";

export interface Snapshot {
  rev: number;
  items: Record<string, { rating: string | null; at: string }>;
  blocks: Record<string, { value: string; at: string }>;
}

/** This browser's lists as the sync sees them */
export interface Local {
  items: Map<string, { rating: string; at: string }>;
  blocks: Map<string, string>;
}

export interface Changes {
  items: SyncItem[];
  blocks: SyncBlock[];
}

export const emptySnapshot = (): Snapshot => ({ rev: 0, items: {}, blocks: {} });

export const keyOf = (section: string, item: string) => `${section}|${item}`;

function splitKey(key: string): { section: Section; item: string } {
  const bar = key.indexOf("|");
  return { section: key.slice(0, bar) as Section, item: key.slice(bar + 1) };
}

/** What to send: every local row that differs from the snapshot, removals for rows that went away, and blocks
 *  whose text changed. removedAt / blockAt hold when this browser removed a row / changed a block. */
export function planPush(snap: Snapshot, local: Local, removedAt: Record<string, string>, blockAt: Record<string, string>, now: string): Changes {
  const items: SyncItem[] = [];
  for (const [key, row] of local.items) {
    const was = snap.items[key];
    if (!was || was.rating !== row.rating || was.at !== row.at) items.push({ ...splitKey(key), rating: row.rating, at: row.at });
  }
  for (const [key, was] of Object.entries(snap.items))
    if (was.rating !== null && !local.items.has(key)) items.push({ ...splitKey(key), rating: null, at: removedAt[key] ?? now });
  const blocks: SyncBlock[] = [];
  for (const [name, value] of local.blocks)
    if (snap.blocks[name]?.value !== value) blocks.push({ name: name as BlockName, value, at: blockAt[name] ?? now });
  return { items, blocks };
}

/** Take in the server's rows: they replace the local ones (rating null removes). Keys in `changedSince` were
 *  changed here while the sync was running; they're left alone and go up next time. */
export function applyPull(local: Local, answer: Changes, changedSince: Set<string>): Local {
  const items = new Map(local.items);
  const blocks = new Map(local.blocks);
  for (const row of answer.items) {
    const key = keyOf(row.section, row.item);
    if (changedSince.has(key)) continue;
    if (row.rating === null) items.delete(key);
    else items.set(key, { rating: row.rating, at: row.at });
  }
  for (const b of answer.blocks) if (!changedSince.has(b.name)) blocks.set(b.name, b.value);
  return { items, blocks };
}

/** The snapshot after a sync: the old one plus every row the answer brought */
export function nextSnapshot(snap: Snapshot, answer: Changes, rev: number): Snapshot {
  const items = { ...snap.items };
  const blocks = { ...snap.blocks };
  for (const row of answer.items) items[keyOf(row.section, row.item)] = { rating: row.rating, at: row.at };
  for (const b of answer.blocks) blocks[b.name] = { value: b.value, at: b.at };
  return { rev, items, blocks };
}

/** What the lists should take in after a sync: the answer, plus the account's copy of anything sent that lost
 *  (an older date than the account's). The answer leaves those out because they didn't change on the server,
 *  so without this the local list would keep the losing value and send it again every time.
 *  `after` = nextSnapshot(...) for this answer: everything the account holds. */
export function settle(after: Snapshot, pushed: Changes, answer: SyncAnswer | Changes): Changes {
  const items = [...answer.items];
  const blocks = [...answer.blocks];
  const answered = new Set(answer.items.map((r) => keyOf(r.section, r.item)));
  for (const p of pushed.items) {
    const key = keyOf(p.section, p.item);
    const held = after.items[key];
    if (!answered.has(key) && held) items.push({ section: p.section, item: p.item, rating: held.rating, at: held.at });
  }
  const answeredBlocks = new Set(answer.blocks.map((b) => b.name));
  for (const p of pushed.blocks) {
    const held = after.blocks[p.name];
    if (!answeredBlocks.has(p.name) && held) blocks.push({ name: p.name, value: held.value, at: held.at });
  }
  return { items, blocks };
}

export type FirstSignIn = { kind: "upload" } | { kind: "same" } | { kind: "ask"; missing: number };

/** Signing in on a browser that may already have ratings: an empty account just takes them; otherwise count
 *  the local ratings the account doesn't have (or has differently), so the browser can ask before adding them */
export function firstSignIn(local: Local, account: Changes): FirstSignIn {
  const held = new Map(account.items.filter((r) => r.rating !== null).map((r) => [keyOf(r.section, r.item), r.rating]));
  if (held.size === 0 && account.blocks.length === 0) return { kind: "upload" };
  let missing = 0;
  for (const [key, row] of local.items) if (held.get(key) !== row.rating) missing++;
  return missing === 0 ? { kind: "same" } : { kind: "ask", missing };
}

/** "Add them to your account": every local rating with its own date (the server's merge keeps the newer one).
 *  Settings and the Watch together list: a block the account already has stays; one it lacks goes up. */
export function addChoice(local: Local, account: Changes, now: string): Changes {
  const items: SyncItem[] = [...local.items].map(([key, row]) => ({ ...splitKey(key), rating: row.rating, at: row.at }));
  const has = new Set(account.blocks.map((b) => b.name));
  const blocks: SyncBlock[] = [...local.blocks]
    .filter(([name]) => !has.has(name as BlockName))
    .map(([name, value]) => ({ name: name as BlockName, value, at: now }));
  return { items, blocks };
}

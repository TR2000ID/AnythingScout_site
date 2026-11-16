// Sync: the browser sends what changed since it last synced, the server merges it in and answers with
// everything that changed since then (from any device).
//   POST /api/account/sync {rev, items, blocks} → {rev, items, blocks}
// Ratings: each one on its own, the newer `at` wins (a removal is rating null with its own `at`, so removing
// on the phone beats an older rating on the PC). Same `at` on both sides: the server's copy stays.
// Settings and the Watch together list: each saved whole as a block; the newer block wins.
// Every change gets the account's next revision number, so "rows with rev > N" = what a device hasn't seen.
import type { Env, User } from "./account";
import { HttpError } from "./http";

export type Section = "anime" | "games";
export type BlockName = "anime.settings" | "games.settings" | "anime.friends";

export interface SyncItem {
  section: Section;
  item: string; // "mal:5114", "steam:730"
  rating: string | null; // null = removed
  at: string;
}

export interface SyncBlock {
  name: BlockName;
  value: string; // the browser's own JSON text; the server never looks inside
  at: string;
}

export interface SyncAnswer {
  rev: number;
  items: SyncItem[];
  blocks: SyncBlock[];
}

const SECTIONS: readonly string[] = ["anime", "games"];
const BLOCK_NAMES: readonly string[] = ["anime.settings", "games.settings", "anime.friends"];
const RATINGS: readonly string[] = ["loved", "liked", "okay", "disliked", "hidden"];
const ITEM_KEY = /^[a-z0-9]+:[A-Za-z0-9_.-]{1,60}$/;
export const MAX_ITEMS = 5000;
export const MAX_BLOCK_CHARS = 1_000_000;
export const MAX_BODY_CHARS = 4_000_000;
const MAX_BOUND = 100; // D1 refuses more bound values than this in one statement

/** Does the incoming row replace the existing one? Only when it's newer (ISO-8601 UTC compares as text). */
export function mergeRow(existing: { at: string } | null, incoming: { at: string }): boolean {
  return existing === null || incoming.at > existing.at;
}

const bad = (message: string) => new HttpError(400, "bad_sync", { message });

/** Every `at` stored the same way (toISOString), so comparing the text is comparing the time */
function normalizeAt(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 64) throw bad("at must be a date");
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw bad("at must be a date");
  const at = new Date(ms).toISOString();
  if (!/^\d{4}-/.test(at)) throw bad("at must be a date"); // years past 9999 would break the text order
  return at;
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Check the whole request before anything is written: a bad part refuses all of it */
export function readSyncBody(text: string): { rev: number; items: SyncItem[]; blocks: SyncBlock[] } {
  if (text.length > MAX_BODY_CHARS) throw new HttpError(413, "too_big");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw bad("not JSON");
  }
  if (typeof body !== "object" || body === null) throw bad("not an object");
  const { rev, items, blocks } = body;
  if (typeof rev !== "number" || !Number.isInteger(rev) || rev < 0) throw bad("rev must be a whole number, 0 or more");
  if (!Array.isArray(items) || !Array.isArray(blocks)) throw bad("items and blocks must be lists");
  if (items.length > MAX_ITEMS) throw bad(`at most ${MAX_ITEMS} items per sync`);
  if (blocks.length > BLOCK_NAMES.length * 2) throw bad("too many blocks");

  // The same row twice in one request: keep the newer one
  const itemsByKey = new Map<string, SyncItem>();
  for (const raw of items as Record<string, unknown>[]) {
    if (typeof raw !== "object" || raw === null) throw bad("an item must be an object");
    const { section, item, rating } = raw;
    if (typeof section !== "string" || !SECTIONS.includes(section)) throw bad("unknown section");
    if (typeof item !== "string" || !ITEM_KEY.test(item)) throw bad(`bad item key: ${String(item).slice(0, 80)}`);
    if (rating !== null && (typeof rating !== "string" || !RATINGS.includes(rating))) throw bad("unknown rating");
    const row: SyncItem = { section: section as Section, item, rating: rating as string | null, at: normalizeAt(raw.at) };
    const key = `${section}|${item}`;
    const seen = itemsByKey.get(key);
    if (!seen || mergeRow(seen, row)) itemsByKey.set(key, row);
  }

  const blocksByName = new Map<string, SyncBlock>();
  let tooBig: string | null = null;
  for (const raw of blocks as Record<string, unknown>[]) {
    if (typeof raw !== "object" || raw === null) throw bad("a block must be an object");
    const { name, value } = raw;
    if (typeof name !== "string" || !BLOCK_NAMES.includes(name)) throw bad("unknown block");
    if (typeof value !== "string") throw bad("a block's value must be text");
    if (value.length > MAX_BLOCK_CHARS) tooBig ??= name;
    const row: SyncBlock = { name: name as BlockName, value, at: normalizeAt(raw.at) };
    const seen = blocksByName.get(name);
    if (!seen || mergeRow(seen, row)) blocksByName.set(name, row);
  }
  if (tooBig) throw new HttpError(413, "too_big", { name: tooBig });
  return { rev, items: [...itemsByKey.values()], blocks: [...blocksByName.values()] };
}

/** The `at` already saved for these rows (read in chunks of D1's limit) */
async function savedItemDates(env: Env, userId: number, items: SyncItem[]): Promise<Map<string, string>> {
  const saved = new Map<string, string>();
  for (const section of SECTIONS) {
    const keys = items.filter((i) => i.section === section).map((i) => i.item);
    for (const part of chunks(keys, MAX_BOUND - 2)) {
      const { results } = await env.DB.prepare(
        `SELECT item, at FROM items WHERE user_id = ? AND section = ? AND item IN (${part.map(() => "?").join(",")})`,
      )
        .bind(userId, section, ...part)
        .all<{ item: string; at: string }>();
      for (const r of results) saved.set(`${section}|${r.item}`, r.at);
    }
  }
  return saved;
}

export async function sync(env: Env, user: User, request: Request): Promise<SyncAnswer> {
  const body = readSyncBody(await request.text());

  // Which of the incoming rows win? (Only to know whether there's anything to write: the writes below check
  // the dates again themselves, so another device syncing at the same moment can't make an older row win.)
  const savedItems = await savedItemDates(env, user.id, body.items);
  const itemWinners = body.items.filter((i) => {
    const at = savedItems.get(`${i.section}|${i.item}`);
    return mergeRow(at === undefined ? null : { at }, i);
  });
  const { results: savedBlocks } = await env.DB.prepare("SELECT name, at FROM blocks WHERE user_id = ?").bind(user.id).all<{ name: string; at: string }>();
  const blockAt = new Map(savedBlocks.map((b) => [b.name, b.at]));
  const blockWinners = body.blocks.filter((b) => {
    const at = blockAt.get(b.name);
    return mergeRow(at === undefined ? null : { at }, b);
  });

  // One transaction: bump the revision, write the winners with it, then read back what this device hasn't seen
  const statements: D1PreparedStatement[] = [];
  if (itemWinners.length || blockWinners.length) {
    statements.push(env.DB.prepare("UPDATE users SET rev = rev + 1 WHERE id = ?").bind(user.id));
    const ROW_VALUES = 4; // section, item, rating, at (+ ?1 = user, shared by every row)
    for (const part of chunks(itemWinners, Math.floor((MAX_BOUND - 1) / ROW_VALUES))) {
      const rows = part.map((_, i) => {
        const n = 2 + i * ROW_VALUES;
        return `(?1, ?${n}, ?${n + 1}, ?${n + 2}, ?${n + 3}, (SELECT rev FROM users WHERE id = ?1))`;
      });
      statements.push(
        env.DB.prepare(
          `INSERT INTO items (user_id, section, item, rating, at, rev) VALUES ${rows.join(", ")}
           ON CONFLICT (user_id, section, item) DO UPDATE SET rating = excluded.rating, at = excluded.at, rev = excluded.rev
           WHERE excluded.at > items.at`,
        ).bind(user.id, ...part.flatMap((r) => [r.section, r.item, r.rating, r.at])),
      );
    }
    for (const b of blockWinners)
      statements.push(
        env.DB.prepare(
          `INSERT INTO blocks (user_id, name, value, at, rev) VALUES (?1, ?2, ?3, ?4, (SELECT rev FROM users WHERE id = ?1))
           ON CONFLICT (user_id, name) DO UPDATE SET value = excluded.value, at = excluded.at, rev = excluded.rev
           WHERE excluded.at > blocks.at`,
        ).bind(user.id, b.name, b.value, b.at),
      );
  }
  statements.push(
    env.DB.prepare("SELECT section, item, rating, at FROM items WHERE user_id = ? AND rev > ? ORDER BY rev, section, item").bind(user.id, body.rev),
    env.DB.prepare("SELECT name, value, at FROM blocks WHERE user_id = ? AND rev > ? ORDER BY name").bind(user.id, body.rev),
    env.DB.prepare("SELECT rev FROM users WHERE id = ?").bind(user.id),
  );
  const results = await env.DB.batch(statements);
  const [items, blocks, revRow] = results.slice(-3).map((r) => r.results);
  return {
    rev: (revRow[0] as { rev: number }).rev,
    items: items as SyncItem[],
    blocks: blocks as SyncBlock[],
  };
}

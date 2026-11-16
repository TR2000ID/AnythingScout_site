// Who's signed in on this browser, and what the sync remembers between visits. Saved under its own key; the
// sections' saved lists (anime-scout.ratings, game-scout.ratings…) stay exactly where they always were.
import { createStore, useStore } from "../../anime/state/createStore";
import { emptySnapshot, type Snapshot } from "./engine";
import type { LocalSnapshot } from "./sections";

export const ACCOUNT_KEY = "anything-scout.account";
/** What changed here and hasn't been sent: kept apart from the record, so noting a change (which can happen in any
 *  tab, outside the sync lock) never rewrites the token or the snapshot */
export const PENDING_KEY = "anything-scout.account.pending";

export type SyncStatus = "ok" | "offline" | "too_big";

export type AccountState =
  | { state: "signed_out" }
  | { state: "signed_in"; name: string; token: string; pictureAt: string | null; synced: string | null; status: SyncStatus }
  | { state: "ended"; message: "signed_out" };

/** What's saved in the browser while signed in */
export interface AccountRecord {
  name: string;
  token: string | null; // null after the server said the session is gone ("ended")
  pictureAt: string | null;
  snapshot: Snapshot; // the last state this browser and the account agreed on
  stash: LocalSnapshot | null; // this browser's own lists from before signing in: back on sign-out
  synced: string | null; // when the last sync finished
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The saved record, or null (none, broken, or storage blocked: all mean "signed out") */
export function readRecord(storage: StorageLike): AccountRecord | null {
  try {
    const text = storage.getItem(ACCOUNT_KEY);
    if (!text) return null;
    const r = JSON.parse(text) as Partial<AccountRecord>;
    if (typeof r?.name !== "string" || (r.token !== null && typeof r.token !== "string")) return null;
    return {
      name: r.name,
      token: r.token,
      pictureAt: typeof r.pictureAt === "string" ? r.pictureAt : null,
      snapshot: r.snapshot && typeof r.snapshot.rev === "number" ? r.snapshot : emptySnapshot(),
      stash: r.stash ?? null,
      synced: r.synced ?? null,
    };
  } catch {
    return null;
  }
}

/** Save the record. Returns false when the browser refused (storage blocked or full). */
export function writeRecord(storage: StorageLike, record: AccountRecord): boolean {
  try {
    storage.setItem(ACCOUNT_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function removeRecord(storage: StorageLike) {
  try {
    storage.removeItem(ACCOUNT_KEY);
    storage.removeItem(PENDING_KEY);
  } catch {
    // blocked: nothing was saved anyway
  }
}

export interface Pending {
  removedAt: Record<string, string>; // "games|steam:730" → when it was removed here
  blockAt: Record<string, string>; // "anime.settings" → when it was changed here
}

export function readPending(storage: StorageLike): Pending {
  try {
    const p = JSON.parse(storage.getItem(PENDING_KEY) ?? "null") as Partial<Pending> | null;
    return { removedAt: p?.removedAt ?? {}, blockAt: p?.blockAt ?? {} };
  } catch {
    return { removedAt: {}, blockAt: {} };
  }
}

export function writePending(storage: StorageLike, pending: Pending) {
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // full or blocked: a removal then goes up dated "now" instead (planPush), nothing is lost
  }
}

/** Can this browser keep a sign-in at all? (Private windows can block storage.) */
export function storageWorks(storage: StorageLike): boolean {
  try {
    const probe = `${ACCOUNT_KEY}.probe`;
    storage.setItem(probe, "1");
    const ok = storage.getItem(probe) === "1";
    storage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

export const accountStore = createStore<AccountState>({ state: "signed_out" });

export function useAccount(): AccountState {
  return useStore(accountStore);
}

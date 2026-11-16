// The shapes the sync route uses (worker/src/sync.ts declares the same ones; keep the two identical).
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
  value: string;
  at: string;
}

export interface SyncAnswer {
  rev: number;
  items: SyncItem[];
  blocks: SyncBlock[];
}

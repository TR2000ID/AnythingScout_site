// The four platforms. Names are plain text only: no logos, button symbols or brand colors.
// Whether a platform has data yet comes from public/data/platforms.json (see lib/data.ts).
import type { PlatformInfo } from "./lib/data";

export type PlatformId = "steam" | "playstation" | "xbox" | "switch";
export type Mode = "players" | "tags";

export interface Platform {
  id: PlatformId;
  name: string;
  /** Which consoles count, shown as small text on cards (PC, PS5 / PS4, …) */
  consoles: string;
  /** Modes in the order the switch shows them. Switch has no public player data, so tags only.
   *  platforms.json can narrow this down while a platform's data is still partial (see modesOf). */
  modes: Mode[];
  store: string;
  /** Steam links to the game's page. The console stores get a search for its title until Phase 2
   *  (IGDB) gives each game its store link. */
  storeUrl: (game: { id: number; title: string }) => string;
}

export const PLATFORMS: Platform[] = [
  {
    id: "steam",
    name: "Steam",
    consoles: "PC",
    modes: ["players", "tags"],
    store: "Steam store",
    storeUrl: ({ id }) => `https://store.steampowered.com/app/${id}/`,
  },
  {
    id: "playstation",
    name: "PlayStation",
    consoles: "PS5 / PS4",
    modes: ["players", "tags"],
    store: "PlayStation Store",
    storeUrl: ({ title }) => `https://store.playstation.com/search/${encodeURIComponent(title)}`,
  },
  {
    id: "xbox",
    name: "Xbox",
    consoles: "Series X|S / One / 360",
    modes: ["players", "tags"],
    store: "Xbox Store",
    storeUrl: ({ title }) => `https://www.xbox.com/search/results/games?q=${encodeURIComponent(title)}`,
  },
  {
    id: "switch",
    name: "Switch",
    consoles: "Switch 2 / Switch",
    modes: ["tags"],
    store: "Nintendo eShop",
    storeUrl: () => "https://www.nintendo.com/store/",
  },
];

export const platformById = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<PlatformId, Platform>;

/** The modes this platform has right now: PlayStation and Xbox have no tags yet, so Players also liked only. */
export function modesOf(platform: Platform, info?: PlatformInfo): Mode[] {
  return info?.modes ?? platform.modes;
}

/** The mode to actually use: the one you picked if this platform has it, otherwise its first one. */
export function modeFor(platform: Platform, picked: Mode, info?: PlatformInfo): Mode {
  const modes = modesOf(platform, info);
  return modes.includes(picked) ? picked : modes[0];
}

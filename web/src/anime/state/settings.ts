// Your settings: language, titles, mode, hidden gems, where-to-watch region, filters.
// Only what you changed gets saved, so a better default reaches you if you never touched that setting.
import { createStore, loadSaved, save, useStore } from "./createStore";
import type { Mode } from "../lib/recommend";
import { TEXTS } from "../texts";
import type { Show } from "../lib/data";

export type Lang = "en" | "ja";
export type Region = "jp" | "global"; // where-to-watch: Japanese services, or the global ones AniList lists
export type ShowType = "all" | "tv" | "movie" | "other"; // other = ONA / OVA

export interface Filters {
  from: number | null; // aired in or after this year
  to: number | null; // aired in or before this year
  type: ShowType;
}

export interface Settings {
  lang: Lang; // menus and text
  titles: Lang; // show titles: English, or the Japanese title
  mode: Mode;
  gems: number; // 0 = as measured, 1 = strongly favor less-known shows (the slider)
  region: Region;
  filters: Filters;
}

const KEY = "anime-scout.settings";
const browserJapanese = navigator.language.toLowerCase().startsWith("ja");

export const DEFAULTS: Settings = {
  lang: browserJapanese ? "ja" : "en", // your call: follow the browser
  titles: browserJapanese ? "ja" : "en",
  mode: "fans", // the accuracy test: 37.6% vs 12.9% for tags (Phase 2 walkthrough)
  gems: 0,
  region: browserJapanese ? "jp" : "global",
  filters: { from: null, to: null, type: "all" },
};

/** Any saved value → full settings: the defaults plus the saved fields that make sense (a bad "lang" would leave
 *  the site with no text at all). Used on load, and for settings an account brings from another device. */
export function settingsFrom(saved: unknown): Settings {
  if (!saved || typeof saved !== "object") return { ...DEFAULTS, filters: { ...DEFAULTS.filters } };
  const raw = saved as Record<string, unknown>;
  const oneOf = <T extends string>(value: unknown, options: T[]) => (options.includes(value as T) ? (value as T) : undefined);
  const year = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const f = (typeof raw.filters === "object" && raw.filters ? raw.filters : {}) as Record<string, unknown>;
  const out: Partial<Settings> = {
    lang: oneOf(raw.lang, ["en", "ja"]),
    titles: oneOf(raw.titles, ["en", "ja"]),
    mode: oneOf(raw.mode, ["fans", "tags"]),
    gems: typeof raw.gems === "number" && raw.gems >= 0 && raw.gems <= 1 ? raw.gems : undefined,
    region: oneOf(raw.region, ["jp", "global"]),
    filters: { from: year(f.from), to: year(f.to), type: oneOf(f.type, ["all", "tv", "movie", "other"]) ?? "all" },
  };
  const changed: Partial<Settings> = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  return { ...DEFAULTS, ...changed, filters: { ...DEFAULTS.filters, ...changed.filters } };
}

/** What gets saved: only what differs from the defaults */
export function savedForm(s: Settings): Partial<Settings> {
  const diff: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[])
    if (JSON.stringify(s[key]) !== JSON.stringify(DEFAULTS[key])) Object.assign(diff, { [key]: s[key] });
  return diff;
}

/** What's saved right now (another tab may have changed it since this one loaded) */
export const readSavedSettings = () => settingsFrom(loadSaved<unknown>(KEY));

export const settingsStore = createStore<Settings>(readSavedSettings());

settingsStore.subscribe(() => {
  const now = settingsStore.get();
  save(KEY, savedForm(now));
  document.documentElement.lang = now.lang;
});
document.documentElement.lang = settingsStore.get().lang;

// Another tab changed them: pick that up here too (otherwise this tab would later save its older copy over it,
// and with an account that older copy would reach every device)
window.addEventListener("storage", (event) => {
  if (event.key === KEY) settingsStore.set(readSavedSettings());
});

export function useSettings() {
  return useStore(settingsStore);
}

export function updateSettings(change: Partial<Settings>) {
  settingsStore.set((s) => ({ ...s, ...change }));
}

export function useTexts() {
  return TEXTS[useSettings().lang];
}

/** The slider (0-1) as the math's exponent. 1 at the far right: a show scored by 10x fewer people needs a 10x
 *  weaker link to tie. (0.5 was tried first: the top stayed mostly mega-hits) */
export const gemsPower = (gems: number) => gems;

/** The name to show for a show, following Settings → Titles */
export function titleOf(show: Show, titles: Lang): string {
  return titles === "ja" && show.titleJa ? show.titleJa : show.title;
}

/** The other name, shown small under the main one when a show has both */
export function altTitleOf(show: Show, titles: Lang): string | null {
  if (!show.titleJa || show.titleJa === show.title) return null;
  return titles === "ja" ? show.title : show.titleJa;
}

export function filterCount(f: Filters): number {
  return (f.from !== null ? 1 : 0) + (f.to !== null ? 1 : 0) + (f.type !== "all" ? 1 : 0);
}

const TYPE_OF: Record<ShowType, string[] | null> = {
  all: null,
  tv: ["TV"],
  movie: ["MOVIE"],
  other: ["ONA", "OVA", "TV_SHORT"],
};

/** What can be recommended under the filters */
export function passes(f: Filters) {
  const types = TYPE_OF[f.type];
  return (show: Show) =>
    (f.from === null || (show.year ?? 0) >= f.from) &&
    (f.to === null || (show.year ?? 9999) <= f.to) &&
    (!types || types.includes(show.type ?? ""));
}

// Your settings: language, game titles, Steam store, platform, mode, filters.
// Only what you changed gets saved, so a better default reaches you if you never touched that setting.
import { createStore, loadSaved, save, useStore } from "./createStore";
import type { Mode, PlatformId } from "../platforms";
import { TEXTS, type Texts } from "../texts";
import type { Game, Price, Store } from "../lib/data";

export type Lang = "en" | "ja";

export interface Filters {
  from: number | null; // released in or after this year
  to: number | null; // released in or before this year
  japanese: boolean; // only games with Japanese language support
  onSale: boolean; // only games on sale today (platforms with prices: Steam)
}

export interface Settings {
  lang: Lang; // menus and text
  titles: Lang; // game titles: English, or the Japanese store name when there is one
  store: Store; // Steam prices and sales: the US store ($) or the Japanese one (¥)
  platform: PlatformId;
  mode: Mode;
  filters: Filters;
}

const KEY = "game-scout.settings";
const browserJapanese = navigator.language.toLowerCase().startsWith("ja");

export const DEFAULTS: Settings = {
  lang: browserJapanese ? "ja" : "en",
  titles: browserJapanese ? "ja" : "en",
  store: browserJapanese ? "jp" : "us",
  platform: "steam",
  mode: "players", // Steam Scout's accuracy test: 9.2% vs 3.8% precision@10
  filters: { from: null, to: null, japanese: false, onSale: false },
};

/** Any saved value → full settings: the defaults plus the saved fields that make sense. Used on load, and for
 *  settings an account brings from another device. */
export function settingsFrom(saved: unknown): Settings {
  if (!saved || typeof saved !== "object") return { ...DEFAULTS, filters: { ...DEFAULTS.filters } };
  const raw = saved as Record<string, unknown>;
  const oneOf = <T extends string>(value: unknown, options: T[]) => (options.includes(value as T) ? (value as T) : undefined);
  const year = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const flag = (value: unknown) => (typeof value === "boolean" ? value : undefined);
  const f = (typeof raw.filters === "object" && raw.filters ? raw.filters : {}) as Record<string, unknown>;
  const out: Partial<Settings> = {
    lang: oneOf(raw.lang, ["en", "ja"]),
    titles: oneOf(raw.titles, ["en", "ja"]),
    store: oneOf(raw.store, ["us", "jp"]),
    platform: oneOf(raw.platform, ["steam", "playstation", "xbox", "switch"]),
    mode: oneOf(raw.mode, ["players", "tags"]),
  };
  const changed: Partial<Settings> = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  const filters = {
    from: year(f.from),
    to: year(f.to),
    japanese: flag(f.japanese) ?? DEFAULTS.filters.japanese,
    onSale: flag(f.onSale) ?? DEFAULTS.filters.onSale,
  };
  return { ...DEFAULTS, ...changed, filters };
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

/** The name to show for a game, following Settings → Game titles */
export function titleOf(game: Game, titles: Lang): string {
  return titles === "ja" && game.titleJa ? game.titleJa : game.title;
}

/** The other name, shown small under the main one when a game has both */
export function altTitleOf(game: Game, titles: Lang): string | null {
  if (!game.titleJa) return null;
  return titles === "ja" ? game.title : game.titleJa;
}

/** Which consoles, as cards show it: "PS5 / PS4", "Xbox 360", or "360 · back-compat" when today's Xbox plays it */
export function consolesOf(game: Game, t: Texts): string {
  return game.backcompat ? t.backcompat : (game.consoles ?? "");
}

/** `hasPrices`: "On sale" only counts on platforms with prices (it's not shown on the others) */
export function filterCount(f: Filters, hasPrices: boolean): number {
  return (f.from !== null ? 1 : 0) + (f.to !== null ? 1 : 0) + (f.japanese ? 1 : 0) + (f.onSale && hasPrices ? 1 : 0);
}

/** A game's price in your store: undefined = no price data (consoles), null = this store doesn't sell it */
export function priceOf(game: Game, store: Store): Price | null | undefined {
  return game.prices ? game.prices[store] : undefined;
}

export function isOnSale(game: Game, store: Store): boolean {
  return (priceOf(game, store)?.discount ?? 0) > 0;
}

/** What can be recommended. Steam games your store doesn't sell (delisted, or not sold in Japan) are left
 *  out: you can still find and rate them, they just can't be bought. Games with no price data pass. */
export function passes(f: Filters, store: Store) {
  return (game: Game) => {
    const price = priceOf(game, store);
    return (
      (f.from === null || game.year >= f.from) &&
      (f.to === null || game.year <= f.to) &&
      (!f.japanese || game.japanese) &&
      price !== null &&
      (!f.onSale || price === undefined || price.discount > 0)
    );
  };
}

// Rating a game from anywhere on the site: save it, then show a message with Undo.
import type { Game } from "../lib/data";
import type { Tier } from "../lib/recommend";
import { TEXTS } from "../texts";
import { restoreRating, setRating } from "./ratings";
import { settingsStore, titleOf } from "./settings";
import { showToast } from "./ui";

export function rate(game: Game, tier: Tier | null) {
  const before = setRating(game.key, tier);
  if (before?.rating === tier) return;
  const { lang, titles } = settingsStore.get();
  const t = TEXTS[lang];
  const title = titleOf(game, titles);
  const text =
    tier === "hidden" ? t.toast.hidden(title) : tier ? t.toast.rated(title, t.tiers[tier]) : t.toast.removed(title);
  showToast(text, () => restoreRating(game.key, before));
}

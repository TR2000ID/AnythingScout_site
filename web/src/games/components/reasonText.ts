// "Why this?" as words: "31% of Hades fans liked this" (short, on cards) or a full sentence (details popup).
import { dataStore } from "../lib/data";
import type { Reason } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { titleOf, useSettings, useTexts } from "../state/settings";

export function useReasonText(reason: Reason | null, length: "short" | "long"): string | null {
  const t = useTexts();
  const { titles, lang } = useSettings();
  const catalogs = useStore(dataStore).catalogs;
  if (!reason) return null;

  const because = titleOf(reason.because, titles);
  const tagNames = catalogs[reason.because.platform]?.tagNames[lang] ?? [];
  const tags = reason.tags.map((tag) => tagNames[tag]).filter(Boolean);
  if (reason.pct !== null) {
    // Consoles have no reviews: their links come from what people played, so the words say "played"
    const played = catalogs[reason.because.platform]?.info.players !== undefined;
    if (played)
      return length === "short" ? t.reasonPlayed(reason.pct, because) : t.dialog.reasonPlayed(reason.pct, because);
    return length === "short" ? t.reasonPlayers(reason.pct, because) : t.dialog.reasonPlayers(reason.pct, because);
  }
  return length === "short" ? t.reasonTags(because, tags.slice(0, 2)) : t.dialog.reasonTags(because, tags);
}

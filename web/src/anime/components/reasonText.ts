// "Why this?" as words: "31% of Frieren fans liked this" (short, on cards) or a full sentence (details popup).
import type { Reason } from "../lib/recommend";
import { titleOf, useSettings, useTexts } from "../state/settings";

export function useReasonText(reason: Reason | null, length: "short" | "long"): string | null {
  const t = useTexts();
  const { titles } = useSettings();
  if (!reason) return null;
  const because = titleOf(reason.because, titles);
  if (reason.pct !== null) return length === "short" ? t.reasonFans(reason.pct, because) : t.dialog.reasonFans(reason.pct, because);
  return length === "short" ? t.reasonTags(because, reason.tags.slice(0, 2)) : t.dialog.reasonTags(because, reason.tags);
}

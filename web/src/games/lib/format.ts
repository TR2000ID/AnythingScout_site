// Prices and dates the way each store and language writes them: $12.49 / ¥1,700, "Oct 9" / "10月9日".
import type { Store } from "./data";
import type { Lang } from "../state/settings";

/** $12.49 in the US store, ¥1,700 in the Japanese one (yen has no cents) */
export function formatPrice(value: number, store: Store): string {
  return store === "jp"
    ? `¥${Math.round(value).toLocaleString("ja-JP")}`
    : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A day in your own time zone: "Oct 9" / "10月9日" */
export function formatDay(unixSeconds: number, lang: Lang): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric" });
}

/** When data was updated, in your own time zone: "Oct 8, 4:05 AM" / "10月8日 4:05" */
export function formatWhen(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Seasons and dates the way each language writes them: "Fall 2023" / "2023年秋".
import type { Lang } from "../state/settings";

const SEASONS: Record<string, { en: string; ja: string }> = {
  WINTER: { en: "Winter", ja: "冬" },
  SPRING: { en: "Spring", ja: "春" },
  SUMMER: { en: "Summer", ja: "夏" },
  FALL: { en: "Fall", ja: "秋" },
};

/** "Fall 2023" / "2023年秋"; just the year when the season isn't known */
export function formatSeason(year: number | null, season: string | null, lang: Lang): string {
  if (!year) return "";
  const s = season ? SEASONS[season] : undefined;
  if (!s) return lang === "ja" ? `${year}年` : String(year);
  return lang === "ja" ? `${year}年${s.ja}` : `${s.en} ${year}`;
}

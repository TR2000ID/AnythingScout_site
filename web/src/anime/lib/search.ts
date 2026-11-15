// Search in English, romaji and Japanese. Titles and what you type both go through searchKey(), so
// "フリーレン", "ふりーれん", "ﾌﾘｰﾚﾝ" and "FRIEREN" find the same show, in any word order.
import type { Show } from "./data";

export function searchKey(text: string): string {
  return text
    .normalize("NFKC") // full-width ＡＢＣ / half-width ｶﾀｶﾅ → normal letters
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)) // katakana → hiragana
    .replace(/[^\p{L}\p{N}]+/gu, " ") // punctuation (: ' ・ !) → space
    .trim();
}

/** What search compares against, worked out once per show when the data loads. */
export interface SearchIndex {
  all: string; // every title, no spaces
  titles: string[]; // each title on its own, no spaces
  words: string[]; // every word of every title
}

export function indexTitles(titles: (string | null)[]): SearchIndex {
  const keys = [...new Set(titles.filter((t): t is string => !!t).map(searchKey))];
  const compact = keys.map((k) => k.replace(/ /g, ""));
  return { all: compact.join(""), titles: compact, words: keys.flatMap((k) => k.split(" ")) };
}

export function search(shows: Show[], query: string, limit = 8): Show[] {
  const key = searchKey(query);
  if (!key) return [];
  const words = key.split(" ");
  const compact = key.replace(/ /g, "");

  const scored: { show: Show; score: number }[] = [];
  for (const show of shows) {
    const index = show.search;
    if (!words.every((word) => index.all.includes(word))) continue;
    // Better matches first: a whole title ("monster" is Monster, not My Little Monster), then titles
    // that start with what you typed, then whole words. Popular shows win ties (log: never above a whole title)
    let score = Math.log10(show.popularity + 10);
    if (index.titles.includes(compact)) score += 20;
    else if (index.titles.some((t) => t.startsWith(compact))) score += 10;
    if (words.every((word) => index.words.some((w) => w.startsWith(word)))) score += 5;
    if (!show.recommend) score -= 3; // specials and music videos after the shows
    scored.push({ show, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.show);
}

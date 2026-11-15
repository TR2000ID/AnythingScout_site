// Search in English and Japanese. Both the titles and what you type go through searchKey(), so
// "ペルソナ", "ぺるそな", "ﾍﾟﾙｿﾅ" and "PERSONA" all find the same game, in any word order.
import type { Game } from "./data";

export function searchKey(text: string): string {
  return text
    .normalize("NFKC") // full-width ＡＢＣ / half-width ｶﾀｶﾅ → normal letters
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)) // katakana → hiragana
    .replace(/[^\p{L}\p{N}]+/gu, " ") // punctuation (: ' ™ ・) → space
    .trim();
}

/** What search compares against, worked out once per game when the data loads. */
export interface SearchIndex {
  all: string; // every title, no spaces: "persona5royalぺるそな5ざろいやる"
  titles: string[]; // each title on its own, no spaces
  words: string[]; // every word of every title
}

export function indexTitles(titles: (string | null)[]): SearchIndex {
  const keys = titles.filter((t): t is string => !!t).map(searchKey);
  const compact = keys.map((k) => k.replace(/ /g, ""));
  return { all: compact.join(""), titles: compact, words: keys.flatMap((k) => k.split(" ")) };
}

/** `platform`: the one chosen in the sidebar. Its games come first, since the same game is often on several. */
export function search(games: Game[], query: string, limit = 8, platform?: string): Game[] {
  const key = searchKey(query);
  if (!key) return [];
  const words = key.split(" ");
  const compact = key.replace(/ /g, "");

  const scored: { game: Game; score: number }[] = [];
  for (const game of games) {
    const index = game.search;
    if (!words.every((word) => index.all.includes(word))) continue;
    // Better matches first: the whole title, then titles that start with what you typed,
    // then whole words. Popular games win ties (log, so popularity never buries an exact match).
    let score = Math.log10(game.popularity + 10);
    if (game.platform === platform) score += 3;
    if (index.titles.includes(compact)) score += 20;
    else if (index.titles.some((t) => t.startsWith(compact))) score += 10;
    if (words.every((word) => index.words.some((w) => w.startsWith(word)))) score += 5;
    scored.push({ game, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.game);
}

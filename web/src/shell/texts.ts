// The frame's words: the service bar and the Soon pages. Each section keeps its own texts (anime/texts.ts).

/** Placeholder until you pick the site's name: change it here (and in index.html's <title>) */
export const SITE_NAME = "Anything Scout";

interface ShellTexts {
  sections: string; // the service bar, for screen readers
  games: string;
  anime: string;
  manga: string;
  soon: string;
  soonGamesTitle: string;
  soonGames: string;
  soonMangaTitle: string;
  soonManga: string;
}

export const SHELL_TEXTS: Record<"en" | "ja", ShellTexts> = {
  en: {
    sections: "Sections",
    games: "Games",
    anime: "Anime",
    manga: "Manga & Comics",
    soon: "Soon",
    soonGamesTitle: "Games is coming",
    soonGames: "Games is moving in next: Steam, PlayStation and Xbox picks from Game Scout, with prices and sales.",
    soonMangaTitle: "Manga & Comics is coming",
    soonManga:
      "Manga data is researched (64,833 titles, plus links from 3,273 anime to their source manga). It will get its own section here, with the same account and look.",
  },
  ja: {
    sections: "セクション",
    games: "ゲーム",
    anime: "アニメ",
    manga: "マンガ・コミック",
    soon: "準備中",
    soonGamesTitle: "ゲームは準備中です",
    soonGames: "ゲームは次に引っ越してきます：Game ScoutのSteam・PlayStation・Xboxのおすすめ、価格とセール。",
    soonMangaTitle: "マンガ・コミックは準備中です",
    soonManga:
      "マンガのデータは調査済み（64,833作品、アニメ3,273作品から原作マンガへのつながり）。同じアカウント・同じデザインで、ここに専用セクションができます。",
  },
};

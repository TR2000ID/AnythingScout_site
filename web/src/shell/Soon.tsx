// What a section shows before it has moved in.
import { useSettings } from "../anime/state/settings";
import { SHELL_TEXTS } from "./texts";

export function Soon({ section }: { section: "games" | "manga" }) {
  const t = SHELL_TEXTS[useSettings().lang];
  return (
    <main className="soon-page">
      <h1>{section === "games" ? t.soonGamesTitle : t.soonMangaTitle}</h1>
      <p>{section === "games" ? t.soonGames : t.soonManga}</p>
    </main>
  );
}

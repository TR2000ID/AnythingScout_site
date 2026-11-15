// What a section shows before it has moved in (only Manga & Comics now).
import { SHELL_TEXTS } from "./texts";

export function Soon({ lang }: { lang: "en" | "ja" }) {
  const t = SHELL_TEXTS[lang];
  return (
    <main className="soon-page">
      <h1>{t.soonMangaTitle}</h1>
      <p>{t.soonManga}</p>
    </main>
  );
}

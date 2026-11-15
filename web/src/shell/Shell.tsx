// The whole site: the service bar on top, then the section the address points at.
// "/" (or an address no section knows) is sent to a section: the last one used, see homeFor() in route.ts.
import { useEffect, useLayoutEffect } from "react";
import { App as Anime } from "../anime/App";
import { loadData as loadAnime } from "../anime/lib/data";
import { ratingsStore } from "../anime/state/ratings";
import { useSettings as useAnimeSettings } from "../anime/state/settings";
import { App as Games } from "../games/App";
import { loadData as loadGames } from "../games/lib/data";
import { useSettings as useGamesSettings } from "../games/state/settings";
import { homeFor, navigate, READY, SECTION_KEY, useRoute } from "./route";
import { barLang, onceEach } from "./sections";
import { ServiceBar } from "./ServiceBar";
import { Soon } from "./Soon";

// Each section's data starts downloading the first time it's opened (and never before)
const show = onceEach({ anime: loadAnime, games: loadGames });

export { READY };

// Private windows can block storage: then the site just doesn't remember the last section
function savedSection(): string | null {
  try {
    return localStorage.getItem(SECTION_KEY);
  } catch {
    return null;
  }
}

function saveSection(section: string) {
  try {
    localStorage.setItem(SECTION_KEY, section);
  } catch {
    // nothing to do
  }
}

export function Shell() {
  const route = useRoute();
  const lang = barLang(route?.section, useAnimeSettings().lang, useGamesSettings().lang);

  // Before the screen is drawn, so "/" never flashes an empty page
  useLayoutEffect(() => {
    if (route) saveSection(route.section);
    else navigate(`/${homeFor(savedSection(), READY, ratingsStore.get().size > 0)}/${location.search}`, true);
    if (route) show(route.section);
  }, [route]);

  // Screen readers and the browser's translate offer read the page's language from <html lang>
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang, route?.section]);

  return (
    <>
      <ServiceBar lang={lang} />
      {route?.section === "games" && <Games />}
      {route?.section === "anime" && <Anime />}
      {route?.section === "manga" && <Soon lang={lang} />}
    </>
  );
}

// Which section's data to download, and which section's language the service bar speaks.
import type { Section } from "./route";

type Lang = "en" | "ja";

/** Each section's loader runs the first time that section is shown, and never again. Opening Games doesn't
 *  download Anime's data (several MB) and the other way round (Games' is ~18 MB). */
export function onceEach(loaders: Partial<Record<Section, () => unknown>>): (section: Section) => void {
  const done = new Set<Section>();
  return (section) => {
    if (done.has(section)) return;
    done.add(section);
    loaders[section]?.();
  };
}

/** Each section still has its own settings (step 3 of the merge makes them one): the bar follows the section
 *  on screen, Games' language on Games, Anime's everywhere else. */
export function barLang(section: Section | undefined, anime: Lang, games: Lang): Lang {
  return section === "games" ? games : anime;
}

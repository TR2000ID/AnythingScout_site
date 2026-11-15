// Addresses inside the site: /games/..., /anime/..., /manga/...
// The first part of the path is the section (the tab in the service bar), the rest is that section's page.

export type Section = "games" | "anime" | "manga";

/** Top bar order (your call): Games · Anime · Manga & Comics */
export const SECTIONS: Section[] = ["games", "anime", "manga"];

/** The last section used, so opening the site lands you back there */
export const SECTION_KEY = "anything-scout.section";

export interface Route {
  section: Section;
  page: string; // the rest of the path without slashes, "" for the section's home
}

/** "/anime/liked" -> { section: "anime", page: "liked" }; "/" or an unknown section -> null */
export function parseRoute(pathname: string): Route | null {
  const [first, ...rest] = pathname.split("/").filter(Boolean);
  if (!SECTIONS.includes(first as Section)) return null;
  return { section: first as Section, page: rest.join("/") };
}

/** Anime Scout's old addresses kept the page after #: "/#/liked" -> "/anime/liked" (the ?extras stay).
 *  Anything else -> null (nothing to change). */
export function legacyRedirect(pathname: string, hash: string, search: string): string | null {
  if (pathname !== "/" || !hash.startsWith("#/")) return null;
  return `/anime/${hash.slice(2)}${search}`;
}

/** Which section "/" opens: the last one used (if it's ready), else Anime for anyone who already has
 *  Anime ratings saved, else the first ready tab. */
export function homeFor(saved: string | null, ready: Section[], hasAnimeRatings: boolean): Section {
  if (ready.includes(saved as Section)) return saved as Section;
  if (hasAnimeRatings && ready.includes("anime")) return "anime";
  return SECTIONS.find((section) => ready.includes(section)) ?? ready[0];
}

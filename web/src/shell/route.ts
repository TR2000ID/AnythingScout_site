// Addresses inside the site: /games/..., /anime/..., /manga/...
// The first part of the path is the section (the tab in the service bar), the rest is that section's page.
import { createStore, useStore } from "../anime/state/createStore";

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

// ---------- in the browser ----------
// Moving between pages changes the address with pushState instead of loading a new page: a full load
// would download the anime data (several MB) again. Back/Forward and bookmarks still work.

const here = () => (typeof location === "undefined" ? null : parseRoute(location.pathname)); // no location in tests

/** Where the address points right now (null = "/" or an address no section knows) */
export const routeStore = createStore<Route | null>(here());

export function useRoute(): Route | null {
  return useStore(routeStore);
}

/** Go to an address inside the site without reloading. replace = don't add a Back step (redirects). */
export function navigate(href: string, replace = false) {
  const url = new URL(href, location.href);
  const now = location.pathname + location.search + location.hash;
  const next = url.pathname + url.search + url.hash;
  if (replace) history.replaceState(null, "", next);
  else if (next !== now) history.pushState(null, "", next);
  routeStore.set(parseRoute(url.pathname));
  window.scrollTo(0, 0);
}

/** Every plain click on a link to this site goes through navigate(). Ctrl/Shift/middle clicks, links that
 *  open a new tab or download a file, and links to other sites behave as usual. */
export function installLinks() {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a");
    if (!link || !link.hasAttribute("href") || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.protocol === "blob:") return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
  window.addEventListener("popstate", () => {
    routeStore.set(here());
    window.scrollTo(0, 0);
  });
}

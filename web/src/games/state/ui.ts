// What's on screen right now: which page, the phone menu, which game's details are open, and the Undo messages.
import { useSyncExternalStore } from "react";
import { createStore, useStore } from "./createStore";
import type { Reason } from "../lib/recommend";
import type { PlatformId } from "../platforms";
import { navigate, routeStore } from "../../shell/route";

// ---------- pages ----------
// The page lives in the address, so Back/Forward and bookmarks work: …/games/liked
// (shell/route.ts reads the address)
// "carry" isn't in the sidebar: only the one-time ratings link (lib/carry.ts) opens it
export type Page = "for-you" | "sales" | "liked" | "okay" | "disliked" | "hidden" | "settings" | "about" | "carry";
const PAGES: Page[] = ["for-you", "sales", "liked", "okay", "disliked", "hidden", "settings", "about", "carry"];

/** The four lists on the My games page */
export const MY_GAMES = ["liked", "okay", "disliked", "hidden"] as const;
export type MyGamesList = (typeof MY_GAMES)[number];

/** "sales" -> "sales"; "" or an unknown page -> For you */
export function pageFromPath(page: string): Page {
  return PAGES.includes(page as Page) ? (page as Page) : "for-you";
}

// Follows the address while it's in Games; on another section it keeps the last Games page
const start = routeStore.get();
const pageStore = createStore<Page>(pageFromPath(start?.section === "games" ? start.page : ""));
routeStore.subscribe(() => {
  const route = routeStore.get();
  if (route?.section === "games") pageStore.set(pageFromPath(route.page));
});

export function usePage() {
  return useStore(pageStore);
}

export function hrefOf(page: Page) {
  return page === "for-you" ? "/games/" : `/games/${page}`;
}

/** The sidebar's choices change For you and Steam sales. Picking one from any other page takes you to For you
 *  to see what it changed, and so does picking another platform than Steam on the sales page. */
export function showPicks(platform?: PlatformId) {
  const page = pageStore.get();
  if (page === "for-you" || (page === "sales" && (!platform || platform === "steam"))) return;
  navigate(hrefOf("for-you"));
}

// ---------- phones ----------
// Under 900px wide the sidebar is hidden and slides in from the left (☰), and the search box moves to the top.
const NARROW = "(max-width: 900px)";

export function useIsNarrow() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(NARROW);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => matchMedia(NARROW).matches,
  );
}

export const menuStore = createStore(false); // is the phone menu open?

// ---------- the details popup ----------
interface Details {
  key: string;
  reason: Reason | null; // shown when it was opened from a recommendation
  match: number | null;
}

export const detailsStore = createStore<Details | null>(null);

export function openDetails(key: string, reason: Reason | null = null, match: number | null = null) {
  detailsStore.set({ key, reason, match });
}

// ---------- Undo messages ----------
export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

export const toastStore = createStore<Toast[]>([]);
let nextId = 1;

export function showToast(text: string, undo?: () => void) {
  const id = nextId++;
  toastStore.set([{ id, text, undo }]); // one at a time: a new message replaces the last one
  window.setTimeout(() => dismissToast(id), 6000);
}

export function dismissToast(id: number) {
  toastStore.set((list) => list.filter((t) => t.id !== id));
}

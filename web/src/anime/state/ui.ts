// What's on screen right now: which page, the phone menu, which show's details are open, and the Undo messages.
import { useSyncExternalStore } from "react";
import { createStore, useStore } from "./createStore";
import type { Reason } from "../lib/recommend";
import { navigate, routeStore } from "../../shell/route";


// ---------- pages ----------
// The page lives in the address, so Back/Forward and bookmarks work: …/anime/liked
// (shell/route.ts reads the address; old …/#/liked links are sent here by main.tsx)
export type Page = "for-you" | "together" | "liked" | "okay" | "disliked" | "hidden" | "settings" | "about";
const PAGES: Page[] = ["for-you", "together", "liked", "okay", "disliked", "hidden", "settings", "about"];

/** The four lists on the My shows page */
export const MY_LIST = ["liked", "okay", "disliked", "hidden"] as const;
export type MyListName = (typeof MY_LIST)[number];

/** "liked" -> "liked"; "" or an unknown page -> For you */
export function pageFromPath(page: string): Page {
  return PAGES.includes(page as Page) ? (page as Page) : "for-you";
}

// Follows the address while it's in Anime; on another section it keeps the last Anime page
const start = routeStore.get();
const pageStore = createStore<Page>(pageFromPath(start?.section === "anime" ? start.page : ""));
routeStore.subscribe(() => {
  const route = routeStore.get();
  if (route?.section === "anime") pageStore.set(pageFromPath(route.page));
});

export function usePage() {
  return useStore(pageStore);
}

export function hrefOf(page: Page) {
  return page === "for-you" ? "/anime/" : `/anime/${page}`;
}

/** The sidebar's choices change For you (and Watch together). Picking one from any other page takes you
 *  to For you, to see what it changed. */
export function showPicks() {
  const page = pageStore.get();
  if (page === "for-you" || page === "together") return;
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

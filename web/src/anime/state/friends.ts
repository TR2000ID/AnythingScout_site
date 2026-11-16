// Watch together's friends list, saved in this browser (moved here from pages/Together.tsx so an account can
// carry it too; same saved key, same shape).
import type { Tier } from "../lib/recommend";
import { createStore, loadSaved, save } from "./createStore";

export interface Friend {
  name: string;
  ratings: Record<string, Tier>; // card key → rating
}

const KEY = "anime-scout.friends";

/** Saved friends we can use: a name and an object of ratings (anything else in storage is skipped). */
export const isFriend = (f: unknown): f is Friend =>
  typeof f === "object" && f !== null && typeof (f as Friend).name === "string" &&
  typeof (f as Friend).ratings === "object" && (f as Friend).ratings !== null;

/** Any saved value → the friends in it (a broken one is no friends) */
export const friendsFrom = (saved: unknown): Friend[] => (Array.isArray(saved) ? saved.filter(isFriend) : []);

/** What's saved right now (another tab may have changed it since this one loaded) */
export const readSavedFriends = () => friendsFrom(loadSaved<unknown>(KEY));

export const friendsStore = createStore<Friend[]>(readSavedFriends());
friendsStore.subscribe(() => save(KEY, friendsStore.get()));

// Another tab changed them: pick that up here too (otherwise this tab would later save its older copy over it,
// and with an account that older copy would reach every device)
window.addEventListener("storage", (event) => {
  if (event.key === KEY) friendsStore.set(readSavedFriends());
});

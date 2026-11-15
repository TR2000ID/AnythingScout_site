// The one-time copy of your Game Scout ratings into this site (Game Scout ran on its own address, and a
// browser keeps each address's saved data apart). tools/read_game_ratings.py reads them from a copy of your
// Edge data and makes a link: /games/carry#<data>. The part after # never leaves the browser (it isn't sent
// to the server), and the Carry page writes it here exactly as it was saved.

export interface CarryData {
  ratings: string; // the saved "game-scout.ratings" text, exactly
  settings: string | null; // the saved "game-scout.settings" text, or null if you never changed a setting
}

/** CarryData → link-safe text (base64url of the UTF-8 JSON, no padding). The Python side does the same. */
export function encodeCarry(data: CarryData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** The link's #part → CarryData, or null if it's missing or not what encodeCarry makes */
export function decodeCarry(hash: string): CarryData | null {
  try {
    const text = hash.replace(/^#/, "").replaceAll("-", "+").replaceAll("_", "/");
    if (!text) return null;
    const binary = atob(text);
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
    if (typeof data !== "object" || data === null) return null;
    const { ratings, settings } = data as Record<string, unknown>;
    if (typeof ratings !== "string" || !(typeof settings === "string" || settings === null)) return null;
    return { ratings, settings };
  } catch {
    return null;
  }
}

/** Ratings already saved here: write if there are none, nothing to do if they're the same, ask before replacing others */
export function planCarry(data: CarryData, existing: string | null): "write" | "same" | "ask" {
  if (existing === null) return "write";
  return existing === data.ratings ? "same" : "ask";
}

/** How many ratings a saved "game-scout.ratings" text holds (0 if it can't be read) */
export function countRatings(saved: string | null): number {
  try {
    const rows = saved ? (JSON.parse(saved) as { rows?: unknown }).rows : null;
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

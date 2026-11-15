// New-episode calendar: a .ics file (Google Calendar, Apple, Outlook can all add it) with the coming
// episodes of shows you like that are on air now, including new seasons of them (sequels). Asked live
// from AniList (it allows browser calls), so the dates are today's, not the data snapshot's.
// Honest limit: it's a file, made once: a delayed episode won't move in it. Make it again to update.
import { askAniList } from "./anilist";

const QUERY = `query ($ids: [Int]) {
  Page(perPage: 50) {
    media(idMal_in: $ids, type: ANIME) {
      idMal status episodes title { romaji english native } nextAiringEpisode { airingAt episode }
      relations { edges { relationType node { idMal status episodes title { romaji english native } nextAiringEpisode { airingAt episode } } } }
    }
  }
}`;

export interface Airing {
  mal: number;
  title: string;
  next: number; // unix seconds of the next episode
  episode: number; // its number
  last: number | null; // the final episode's number, when known
}

const WEEKS_IF_UNKNOWN = 12; // a show with no episode count: three months of weeks

function airingOf(media: any, japanese: boolean): Airing | null {
  if (media?.status !== "RELEASING" || !media.nextAiringEpisode || !media.idMal) return null;
  const t = media.title ?? {};
  return {
    mal: media.idMal,
    title: (japanese ? t.native : t.english) || t.romaji || t.native,
    next: media.nextAiringEpisode.airingAt,
    episode: media.nextAiringEpisode.episode,
    last: media.episodes ?? null,
  };
}

/** Your shows (MyAnimeList IDs) → the ones airing now: themselves or a sequel */
export async function fetchAiring(mals: number[], japanese: boolean): Promise<Airing[]> {
  const found = new Map<number, Airing>();
  for (let i = 0; i < mals.length; i += 50) {
    const { ok, status, body } = await askAniList(QUERY, { ids: mals.slice(i, i + 50) });
    if (!ok || body === null) throw new Error(`AniList answered ${status}`);
    for (const media of body?.data?.Page?.media ?? []) {
      const nodes = [media, ...(media.relations?.edges ?? []).filter((e: any) => e.relationType === "SEQUEL").map((e: any) => e.node)];
      for (const node of nodes) {
        const airing = airingOf(node, japanese);
        if (airing) found.set(airing.mal, airing);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.next - b.next);
}

const stamp = (unix: number) => new Date(unix * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// iCalendar text: commas, semicolons and backslashes need a backslash in front
const text = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

const MAX_LINE_BYTES = 75; // the calendar format (RFC 5545 3.1): longer lines are folded

/** Fold a long line: after every 75 bytes, a line break + one space (calendar apps join them back up).
 *  Counted in UTF-8 bytes and only cut between characters, so a Japanese title is never split mid-letter. */
export function fold(line: string): string {
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    const limit = parts.length ? MAX_LINE_BYTES - 1 : MAX_LINE_BYTES; // later parts start with a space
    if (bytes + size > limit) {
      parts.push(part);
      part = "";
      bytes = 0;
    }
    part += char;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n ");
}

/** The .ics file: one weekly series per show, from its next episode to its last (or 12 weeks).
 *  episodeFrom = the "(ep 5+)" after the title, in the site's language. */
export function buildIcs(shows: Airing[], episodeFrom: (n: number) => string, now = Date.now() / 1000): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Anime Scout//New episodes//EN", "CALSCALE:GREGORIAN"];
  for (const s of shows) {
    const count = s.last ? Math.max(1, s.last - s.episode + 1) : WEEKS_IF_UNKNOWN;
    lines.push(
      "BEGIN:VEVENT",
      // One ID per show, not per episode: a calendar app that gets a newer file updates the show's
      // series instead of adding it a second time
      `UID:anime-scout-${s.mal}@anime-scout`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(s.next)}`,
      `DTEND:${stamp(s.next + 30 * 60)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${count}`,
      `SUMMARY:${text(`${s.title} ${episodeFrom(s.episode)}`)}`,
      `URL:https://myanimelist.net/anime/${s.mal}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n"; // the format wants \r\n line ends
}

/** Hand the file to the browser as a download */
export function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// AniList's GraphQL API, asked straight from the browser (AniList allows it). Used by the list import
// (importList.ts) and the new-episode calendar (calendar.ts).
export const ANILIST = "https://graphql.anilist.co";

export interface AniListAnswer {
  ok: boolean;
  status: number;
  body: any; // the JSON answer, or null if it wasn't JSON
}

/** One AniList call. No connection → throws (fetch's own error); any answer, even an error, is returned. */
export async function askAniList(query: string, variables: Record<string, unknown>): Promise<AniListAnswer> {
  const response = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
}

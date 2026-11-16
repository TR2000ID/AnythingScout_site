// Small helpers every route shares.

export function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

/** An answer with a status and an error code, thrown from deep inside a route and turned into JSON at the top */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

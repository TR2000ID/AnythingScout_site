// Accounts: username only for now (no password). Anyone who knows a username can open that account; the
// sign-in box says so. A password comes later as users.password_hash, with nothing moved.
//   POST   /api/account/create  {name}   → 201 {name, token}      400 bad_name · 409 taken · 429 too_many
//   POST   /api/account/signin  {name}   → 200 {name, token}      404 unknown · 429 too_many
//   POST   /api/account/signout (token)  → 204
//   GET    /api/account/me      (token)  → {name, pictureAt, empty}
//   POST   /api/account/sync    (token)  {rev, items, blocks} → {rev, items, blocks}   (sync.ts)
//   PUT    /api/account/picture (token)  image bytes (webp/jpeg, ≤ 50 KB) → 204   415 wrong type · 413 too big
//   DELETE /api/account/picture (token)  → 204
//   GET    /api/account/picture/<name>   → the picture (public: anyone can see anyone's picture), 404 none
// "(token)" = header Authorization: Bearer <token>. Without a valid one: 401 signed_out.
import { HttpError, json, noContent } from "./http";
import { normalizeName } from "./names";
import { sync } from "./sync";

export interface Env {
  DB: D1Database;
  TMDB_KEY?: string;
}

export interface User {
  id: number;
  name: string;
}

// The guessing limit. Sign-ins with a name that doesn't exist count per address per 10 minutes; creates
// (taken names too: "taken" also tells a guesser the name exists) count per address per hour.
export const SIGNIN_MISSES = 20;
export const CREATES_PER_HOUR = 10;
const SIGNIN_WINDOW_MS = 10 * 60 * 1000;
const CREATE_WINDOW_MS = 60 * 60 * 1000;
const LAST_SEEN_EVERY_MS = 60 * 60 * 1000; // write "last seen" at most once an hour: fewer D1 writes

const nowIso = () => new Date().toISOString();

// ---------- tokens ----------

function base64url(bytes: Uint8Array): string {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A new random session for this user. Only its SHA-256 goes in the database. */
async function newSession(env: Env, userId: number): Promise<string> {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32))); // 43 characters
  const now = nowIso();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, now, now)
    .run();
  return token;
}

function bearer(request: Request): string | null {
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("Authorization") ?? "");
  return m ? m[1] : null;
}

/** Who this request is signed in as, or null */
export async function authUser(request: Request, env: Env): Promise<User | null> {
  const token = bearer(request);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT u.id AS id, u.name AS name, s.last_seen AS last_seen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
  )
    .bind(hash)
    .first<{ id: number; name: string; last_seen: string }>();
  if (!row) return null;
  if (Date.now() - Date.parse(row.last_seen) > LAST_SEEN_EVERY_MS)
    await env.DB.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?").bind(nowIso(), hash).run();
  return { id: row.id, name: row.name };
}

export async function requireUser(request: Request, env: Env): Promise<User> {
  const user = await authUser(request, env);
  if (!user) throw new HttpError(401, "signed_out");
  return user;
}

// ---------- the guessing limit ----------

const ipOf = (request: Request) => request.headers.get("CF-Connecting-IP") ?? "unknown";
const signinWindow = () => `signin:${Math.floor(Date.now() / SIGNIN_WINDOW_MS)}`;
const createWindow = () => `create:${Math.floor(Date.now() / CREATE_WINDOW_MS)}`;

async function missCount(env: Env, ip: string, window: string): Promise<number> {
  const row = await env.DB.prepare("SELECT count FROM misses WHERE ip = ? AND window = ?").bind(ip, window).first<{ count: number }>();
  return row?.count ?? 0;
}

async function addMiss(env: Env, ip: string, window: string) {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO misses (ip, window, count) VALUES (?, ?, 1) ON CONFLICT (ip, window) DO UPDATE SET count = count + 1").bind(ip, window),
    // Old windows are no use any more: tidy them away while we're here (the table stays tiny)
    env.DB.prepare("DELETE FROM misses WHERE window <> ? AND window <> ?").bind(signinWindow(), createWindow()),
  ]);
}

// ---------- routes ----------

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // falls through
  }
  throw new HttpError(400, "bad_json");
}

async function create(request: Request, env: Env): Promise<Response> {
  const name = normalizeName((await readJson(request)).name);
  if (!name) throw new HttpError(400, "bad_name");
  const ip = ipOf(request);
  const window = createWindow();
  if ((await missCount(env, ip, window)) >= CREATES_PER_HOUR) throw new HttpError(429, "too_many");
  await addMiss(env, ip, window);
  const row = await env.DB.prepare("INSERT INTO users (name, created_at) VALUES (?, ?) ON CONFLICT (name) DO NOTHING RETURNING id")
    .bind(name, nowIso())
    .first<{ id: number }>();
  if (!row) throw new HttpError(409, "taken");
  return json({ name, token: await newSession(env, row.id) }, 201);
}

async function signin(request: Request, env: Env): Promise<Response> {
  const name = normalizeName((await readJson(request)).name);
  const ip = ipOf(request);
  const window = signinWindow();
  if ((await missCount(env, ip, window)) >= SIGNIN_MISSES) throw new HttpError(429, "too_many");
  const user = name ? await env.DB.prepare("SELECT id FROM users WHERE name = ?").bind(name).first<{ id: number }>() : null;
  if (!user) {
    await addMiss(env, ip, window);
    throw new HttpError(404, "unknown");
  }
  return json({ name, token: await newSession(env, user.id) });
}

async function signout(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(bearer(request)!)).run();
  return noContent();
}

async function me(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare(
    `SELECT picture_at,
       EXISTS (SELECT 1 FROM items WHERE user_id = ?1 AND rating IS NOT NULL) OR EXISTS (SELECT 1 FROM blocks WHERE user_id = ?1) AS used
     FROM users WHERE id = ?1`,
  )
    .bind(user.id)
    .first<{ picture_at: string | null; used: number }>();
  return json({ name: user.name, pictureAt: row?.picture_at ?? null, empty: !row?.used });
}

async function syncRoute(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  return json(await sync(env, user, request));
}

// ---------- profile picture ----------

export const PICTURE_MAX_BYTES = 50_000;
const PICTURE_TYPES = ["image/webp", "image/jpeg"];

async function putPicture(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const type = (request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (!PICTURE_TYPES.includes(type)) throw new HttpError(415, "bad_type");
  if (Number(request.headers.get("Content-Length") ?? 0) > PICTURE_MAX_BYTES) throw new HttpError(413, "too_big");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > PICTURE_MAX_BYTES) throw new HttpError(413, "too_big");
  if (bytes.byteLength === 0) throw new HttpError(400, "empty");
  await env.DB.prepare("UPDATE users SET picture = ?, picture_type = ?, picture_at = ? WHERE id = ?").bind(bytes, type, nowIso(), user.id).run();
  return noContent();
}

async function deletePicture(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  await env.DB.prepare("UPDATE users SET picture = NULL, picture_type = NULL, picture_at = NULL WHERE id = ?").bind(user.id).run();
  return noContent();
}

async function getPicture(_request: Request, env: Env, path: string): Promise<Response> {
  let name: string | null = null;
  try {
    name = normalizeName(decodeURIComponent(path.slice("/picture/".length)));
  } catch {
    // a broken %-encoding: no such picture
  }
  const row = name
    ? await env.DB.prepare("SELECT picture, picture_type FROM users WHERE name = ? AND picture IS NOT NULL")
        .bind(name)
        .first<{ picture: ArrayLike<number>; picture_type: string }>()
    : null;
  if (!row) throw new HttpError(404, "not_found");
  // D1 hands BLOBs back as a list of numbers (Node's SQLite as a Uint8Array): both become bytes here
  return new Response(new Uint8Array(row.picture), {
    headers: { "Content-Type": row.picture_type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}

type Handler = (request: Request, env: Env, rest: string) => Promise<Response>;

/** Address (after /api/account) → method → handler */
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  "/create": { POST: create },
  "/signin": { POST: signin },
  "/signout": { POST: signout },
  "/me": { GET: me },
  "/sync": { POST: syncRoute },
  "/picture": { PUT: putPicture, DELETE: deletePicture },
};

export async function handleAccount(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.slice("/api/account".length);
  const methods = path.startsWith("/picture/") ? { GET: getPicture } : ROUTES[path];
  try {
    if (!methods) throw new HttpError(404, "not_found");
    const handler = methods[request.method];
    if (!handler) throw new HttpError(405, "method");
    return await handler(request, env, path);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code, ...err.extra }, err.status);
    console.error(err);
    return json({ error: "server" }, 500);
  }
}

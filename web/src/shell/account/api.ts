// Talking to the account server (worker/src/account.ts). Same address as the site, so no CORS.
import type { SyncAnswer, SyncBlock, SyncItem } from "./types";

export type AccountErrorCode = "bad_name" | "taken" | "unknown" | "too_many" | "signed_out" | "too_big" | "offline" | "server" | "no_storage";

const CODES: readonly string[] = ["bad_name", "taken", "unknown", "too_many", "signed_out", "too_big"];

export class AccountError extends Error {
  constructor(
    public code: AccountErrorCode,
    public blockName?: string, // too_big: which block
  ) {
    super(code);
  }
}

export interface SyncBody {
  rev: number;
  items: SyncItem[];
  blocks: SyncBlock[];
}

export interface Api {
  createAccount(name: string): Promise<{ name: string; token: string }>;
  signIn(name: string): Promise<{ name: string; token: string }>;
  signOut(token: string): Promise<void>;
  me(token: string): Promise<{ name: string; pictureAt: string | null; empty: boolean }>;
  sync(token: string, body: SyncBody): Promise<SyncAnswer>;
  putPicture(token: string, picture: Blob): Promise<void>;
  deletePicture(token: string): Promise<void>;
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  let res: Response;
  try {
    res = await fetch(`/api/account${path}`, { ...init, headers });
  } catch {
    throw new AccountError("offline"); // no connection (or the server can't be reached at all)
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (res.ok && body !== null) return body as T;
  const code = typeof body?.error === "string" && CODES.includes(body.error) ? body.error : res.status === 401 ? "signed_out" : "server";
  throw new AccountError(code as AccountErrorCode, typeof body?.name === "string" ? body.name : undefined);
}

const post = (body: unknown, token?: string): RequestInit & { token?: string } => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  token,
});

export const realApi: Api = {
  createAccount: (name) => call("/create", post({ name })),
  signIn: (name) => call("/signin", post({ name })),
  signOut: (token) => call("/signout", { method: "POST", token }),
  me: (token) => call("/me", { token }),
  sync: (token, body) => call("/sync", post(body, token)),
  putPicture: (token, picture) => call("/picture", { method: "PUT", headers: { "Content-Type": picture.type }, body: picture, token }),
  deletePicture: (token) => call("/picture", { method: "DELETE", token }),
};

/** Where a user's picture is shown from (?v= changes with each new picture, so the browser's cache never shows an old one) */
export const pictureUrl = (name: string, pictureAt: string) => `/api/account/picture/${encodeURIComponent(name)}?v=${encodeURIComponent(pictureAt)}`;

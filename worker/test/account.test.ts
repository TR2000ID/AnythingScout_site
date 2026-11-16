// Accounts: create / sign in / sign out / me, the guessing limit, and the username rules.
// The database is fakeD1 (Node's SQLite running the real migrations/), so no Cloudflare is needed.   npm test
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { normalizeName } from "../src/names";
import { fakeD1 } from "./fake-d1";

let env: { DB: ReturnType<typeof fakeD1> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown, opts: { token?: string; ip?: string } = {}): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "CF-Connecting-IP": opts.ip ?? "1.2.3.4" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await worker.fetch(
    new Request(`https://scout.test/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    env as never,
    { waitUntil() {}, passThroughOnException() {} } as never,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeEach(() => {
  env = { DB: fakeD1() };
});

describe("usernames", () => {
  it("keeps capitals, trims, folds full-width forms (NFKC)", () => {
    expect(normalizeName("Ken")).toBe("Ken");
    expect(normalizeName(" Ken ")).toBe("Ken");
    expect(normalizeName("Ｋｅｎ")).toBe("Ken");
    expect(normalizeName("けん_2")).toBe("けん_2");
  });

  it("refuses too short, too long, and other characters", () => {
    expect(normalizeName("k")).toBeNull();
    expect(normalizeName("a".repeat(21))).toBeNull();
    expect(normalizeName("ken!")).toBeNull();
    expect(normalizeName("ken san")).toBeNull();
  });

  it("counts length in characters, not UTF-16 units", () => {
    expect(normalizeName("𠮷".repeat(20))).toBe("𠮷".repeat(20));
    expect(normalizeName("𠮷".repeat(21))).toBeNull();
  });
});

describe("create and sign in", () => {
  it("create → 201 with a 43-character token; the same name again → 409; capitals count", async () => {
    const r = await call("POST", "/account/create", { name: "Ken" });
    expect(r.status).toBe(201);
    expect(r.body.name).toBe("Ken");
    expect(r.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await call("POST", "/account/create", { name: "Ken" })).body).toEqual({ error: "taken" });
    expect((await call("POST", "/account/create", { name: "Ken" })).status).toBe(409);
    expect((await call("POST", "/account/create", { name: "ken" })).status).toBe(201);
  });

  it("a bad name → 400 bad_name", async () => {
    const r = await call("POST", "/account/create", { name: "ken!" });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "bad_name" });
    expect((await call("POST", "/account/create", {})).status).toBe(400);
  });

  it("sign in needs the capitals as created; full-width opens the same account", async () => {
    await call("POST", "/account/create", { name: "Ken" });
    const a = await call("POST", "/account/signin", { name: "Ken" });
    expect(a.status).toBe(200);
    expect(a.body.name).toBe("Ken");
    const b = await call("POST", "/account/signin", { name: "Ｋｅｎ" });
    expect(b.status).toBe(200);
    expect(b.body.name).toBe("Ken");
    expect(b.body.token).not.toBe(a.body.token);
    const c = await call("POST", "/account/signin", { name: "KEN" });
    expect(c.status).toBe(404);
    expect(c.body).toEqual({ error: "unknown" });
  });

  it("only the token's SHA-256 is stored", async () => {
    const { body } = await call("POST", "/account/create", { name: "Ken" });
    const rows = env.DB.raw.prepare("SELECT token_hash FROM sessions").all() as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(body.token);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("me and sign out", () => {
  it("me with the token; without or with junk → 401 signed_out", async () => {
    const { body } = await call("POST", "/account/create", { name: "Ken" });
    expect((await call("GET", "/account/me", undefined, { token: body.token })).body).toEqual({ name: "Ken", pictureAt: null, empty: true });
    const none = await call("GET", "/account/me");
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ error: "signed_out" });
    expect((await call("GET", "/account/me", undefined, { token: "junk" })).status).toBe(401);
  });

  it("sign out ends only that session", async () => {
    const one = (await call("POST", "/account/create", { name: "Ken" })).body.token;
    const two = (await call("POST", "/account/signin", { name: "Ken" })).body.token;
    expect((await call("POST", "/account/signout", undefined, { token: one })).status).toBe(204);
    expect((await call("GET", "/account/me", undefined, { token: one })).status).toBe(401);
    expect((await call("GET", "/account/me", undefined, { token: two })).status).toBe(200);
  });

  it("sign out without a token → 401", async () => {
    expect((await call("POST", "/account/signout")).status).toBe(401);
  });

  it("removing the user (the README's delete command) ends its sessions", async () => {
    const token = (await call("POST", "/account/create", { name: "Ken" })).body.token;
    env.DB.raw.exec("DELETE FROM users WHERE name='Ken'");
    expect((await call("GET", "/account/me", undefined, { token })).status).toBe(401);
  });
});

describe("guessing limit", () => {
  it("21 unknown sign-ins from one address → the 21st is 429, a known name too; another address still works", async () => {
    await call("POST", "/account/create", { name: "Ken" }, { ip: "9.9.9.9" });
    for (let i = 0; i < 20; i++) expect((await call("POST", "/account/signin", { name: `nobody${i}` })).status).toBe(404);
    const blocked = await call("POST", "/account/signin", { name: "nobody20" });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "too_many" });
    expect((await call("POST", "/account/signin", { name: "Ken" })).status).toBe(429);
    expect((await call("POST", "/account/signin", { name: "Ken" }, { ip: "5.6.7.8" })).status).toBe(200);
  });

  it("the 11th create in an hour from one address → 429", async () => {
    for (let i = 0; i < 10; i++) expect((await call("POST", "/account/create", { name: `user${i}` })).status).toBe(201);
    expect((await call("POST", "/account/create", { name: "user10" })).status).toBe(429);
    expect((await call("POST", "/account/create", { name: "user10" }, { ip: "5.6.7.8" })).status).toBe(201);
  });
});

describe("routing", () => {
  it("GET /api/watch still reaches where-to-watch; POST /api/watch → 405", async () => {
    // No TMDB key in this env: the watch code answers 503 no_key, which proves the request reached it
    (globalThis as { caches?: unknown }).caches = { default: { match: async () => undefined, put: async () => undefined } };
    const get = await call("GET", "/watch?tmdb=tv:1");
    expect(get.status).toBe(503);
    expect(get.body.error).toBe("no_key");
    expect((await call("POST", "/watch")).status).toBe(405);
  });

  it("an unknown account address → 404; the wrong method → 405", async () => {
    expect((await call("GET", "/account/nothing")).status).toBe(404);
    expect((await call("GET", "/account/create")).status).toBe(405);
  });

  it("a body that isn't JSON → 400", async () => {
    const res = await worker.fetch(
      new Request("https://scout.test/api/account/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }),
      env as never,
      {} as never,
    );
    expect(res.status).toBe(400);
  });
});

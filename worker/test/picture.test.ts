// Profile pictures: a small square kept in D1 on the user's row.
import { beforeEach, describe, expect, it } from "vitest";
import { account, call, newEnv, type FakeEnv } from "./helpers";

let env: FakeEnv;
let token: string;

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 251);
const put = (body: Uint8Array, type: string, t = token) => call(env, "PUT", "/account/picture", undefined, { token: t, raw: body, type });

beforeEach(async () => {
  env = newEnv();
  token = await account(env, "Ken");
});

describe("profile picture", () => {
  it("PUT 1,000 bytes of webp → 204; me.pictureAt is set; GET gives back the same bytes and type", async () => {
    expect((await put(bytes(1000), "image/webp")).status).toBe(204);
    const me = await call(env, "GET", "/account/me", undefined, { token });
    expect(me.body.pictureAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    const got = await call(env, "GET", "/account/picture/Ken");
    expect(got.status).toBe(200);
    expect(got.res.headers.get("Content-Type")).toBe("image/webp");
    expect(got.res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(got.res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(new Uint8Array(await got.res.arrayBuffer())).toEqual(bytes(1000));
  });

  it("JPEG works too", async () => {
    expect((await put(bytes(10), "image/jpeg")).status).toBe(204);
    expect((await call(env, "GET", "/account/picture/Ken")).res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("PNG → 415; 50,001 bytes → 413; nothing saved", async () => {
    expect((await put(bytes(1000), "image/png")).status).toBe(415);
    expect((await put(bytes(50_001), "image/webp")).status).toBe(413);
    expect((await put(new Uint8Array(0), "image/webp")).status).toBe(400);
    expect((await call(env, "GET", "/account/picture/Ken")).status).toBe(404);
  });

  it("needs a session to change it", async () => {
    expect((await put(bytes(10), "image/webp", "")).status).toBe(401);
    expect((await call(env, "DELETE", "/account/picture")).status).toBe(401);
  });

  it("DELETE → 204, then GET → 404 and me.pictureAt is null", async () => {
    await put(bytes(10), "image/webp");
    expect((await call(env, "DELETE", "/account/picture", undefined, { token })).status).toBe(204);
    expect((await call(env, "GET", "/account/picture/Ken")).status).toBe(404);
    expect((await call(env, "GET", "/account/me", undefined, { token })).body.pictureAt).toBeNull();
  });

  it("GET for Ｋｅｎ (full-width, URL-encoded) serves Ken's; ken (another account) → 404", async () => {
    await account(env, "ken");
    await put(bytes(10), "image/webp");
    expect((await call(env, "GET", `/account/picture/${encodeURIComponent("Ｋｅｎ")}`)).status).toBe(200);
    expect((await call(env, "GET", "/account/picture/ken")).status).toBe(404);
    expect((await call(env, "GET", "/account/picture/nobody")).status).toBe(404);
    expect((await call(env, "GET", "/account/picture/%E0%A4%A")).status).toBe(404); // broken encoding
  });
});

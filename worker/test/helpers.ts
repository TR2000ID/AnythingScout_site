// Shared by the account tests: call the Worker like the browser would, against a fresh fake D1.
import worker from "../src/index";
import { fakeD1 } from "./fake-d1";

export type FakeEnv = { DB: ReturnType<typeof fakeD1> };
export const newEnv = (): FakeEnv => ({ DB: fakeD1() });

export interface CallOptions {
  token?: string;
  ip?: string;
  raw?: BodyInit; // send these bytes as they are (pictures)
  type?: string; // Content-Type for raw
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function call(env: FakeEnv, method: string, path: string, body?: unknown, opts: CallOptions = {}): Promise<{ status: number; body: any; res: Response }> {
  const headers: Record<string, string> = { "CF-Connecting-IP": opts.ip ?? "1.2.3.4" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let payload: BodyInit | undefined;
  if (opts.raw !== undefined) {
    payload = opts.raw;
    if (opts.type) headers["Content-Type"] = opts.type;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await worker.fetch(new Request(`https://scout.test/api${path}`, { method, headers, body: payload }), env as never, {
    waitUntil() {},
    passThroughOnException() {},
  } as never);
  const isJson = (res.headers.get("Content-Type") ?? "").startsWith("application/json");
  return { status: res.status, body: isJson ? await res.json() : null, res };
}

let nextIp = 0;

/** A new account (each from its own address, so the create limit never gets in the way); returns its token */
export async function account(env: FakeEnv, name = "Ken"): Promise<string> {
  const r = await call(env, "POST", "/account/create", { name }, { ip: `10.0.${nextIp >> 8}.${nextIp++ & 255}` });
  if (r.status !== 201) throw new Error(`create ${name}: ${r.status}`);
  return r.body.token;
}

// Tests run in Node, but the stores read the browser's storage and language when they load. This puts small
// stand-ins in place first: import it BEFORE anything that imports a store (or import the store dynamically).
const memory = new Map<string, string>();

export const fakeStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

const define = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
define("localStorage", fakeStorage);
const listeners = new Map<string, Set<(e: unknown) => void>>();
define("window", {
  addEventListener: (type: string, fn: (e: unknown) => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn),
  removeEventListener: (type: string, fn: (e: unknown) => void) => void listeners.get(type)?.delete(fn),
});

/** Pretend another tab just saved this key */
export function fireStorage(key: string) {
  for (const fn of listeners.get("storage") ?? []) fn({ key });
}
define("navigator", { language: "en-US" });
define("document", { documentElement: { lang: "en" } });

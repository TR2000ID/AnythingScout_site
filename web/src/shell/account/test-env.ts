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
define("window", { addEventListener() {}, removeEventListener() {} });
define("navigator", { language: "en-US" });
define("document", { documentElement: { lang: "en" } });

// Usernames: 2–20 characters of letters (any language, so Japanese names work), digits, _ and -.
// Capitals count (Ken and ken are two accounts), but full-width and half-width forms of the same character
// are one (Unicode NFKC): Ｋｅｎ typed on a Japanese keyboard opens Ken. Nothing is lowercased anywhere.

const ALLOWED = /^[\p{L}\p{N}_-]+$/u;

/** The name as stored, or null when it isn't a valid username */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFKC").trim();
  const length = [...name].length; // characters (code points), so 𠮷 counts once, not twice
  if (length < 2 || length > 20 || !ALLOWED.test(name)) return null;
  return name;
}

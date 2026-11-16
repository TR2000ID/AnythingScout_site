// Copied from standup-notes/worker/test/fake-d1.ts (+ foreign keys on).
// A tiny stand-in for Cloudflare D1 built on Node's own SQLite (node:sqlite), so the tests run the
// real SQL from migrations/ without Cloudflare. Only the parts our code uses are here.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: unknown[] = [],
  ) {}
  bind(...params: unknown[]) {
    // Real D1 refuses more than 100 bound values in one query; act the same so tests catch it.
    if (params.length > 100) throw new Error(`D1 allows 100 bound parameters per query, got ${params.length}`);
    // D1 takes ArrayBuffer for BLOBs; Node's SQLite wants a Uint8Array
    return new Statement(this.db, this.sql, params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p)));
  }
  private args() {
    return this.params as never[];
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.args()) as T) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.args()) as T[] };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args());
    return { meta: { changes: Number(r.changes) } };
  }
  /** Inside a batch: a SELECT (or RETURNING) gives its rows, like D1's batch results */
  runNow() {
    const stmt = this.db.prepare(this.sql);
    if (/^\s*SELECT\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) return { results: stmt.all(...this.args()) };
    stmt.run(...this.args());
    return { results: [] };
  }
}

export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON"); // real D1 enforces foreign keys (ON DELETE CASCADE), so act the same
  const dir = join(import.meta.dirname, "..", "migrations");
  for (const file of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, file), "utf8"));
  return {
    prepare: (sql: string) => new Statement(db, sql),
    // D1's batch runs every statement in one transaction: all or nothing
    async batch(statements: Statement[]) {
      db.exec("BEGIN");
      try {
        const results = statements.map((s) => s.runNow());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    raw: db,
  };
}

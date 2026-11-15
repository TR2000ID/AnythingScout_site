// The other half of Games' "Update now" button. It only exists while `npm run dev` runs on your PC:
// the page asks /__update/steam, and this starts `python update_steam.py` in the game-scout repo (next to
// this one; GAME_SCOUT_REPO=<folder> points elsewhere) and keeps what it prints, so the page can show the
// progress. update_steam.py writes into this repo's web/public/data/games (game-scout's site_files.py).
// The built site has no Python behind it, so there the button is hidden and the daily 04:00 task updates.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/** The game-scout repo: GAME_SCOUT_REPO if set, else the folder next to anything-scout */
export function gameScoutRepo(env: string | undefined): string {
  return env || fileURLToPath(new URL("../../game-scout/", import.meta.url));
}

/** The repo's own Python (it has numpy and requests), or plain `python` if there's no .venv */
export function pythonFor(repo: string): string {
  return [".venv/Scripts/python.exe", ".venv/bin/python"].map((p) => join(repo, p)).find((p) => existsSync(p)) ?? "python";
}

const REPO = gameScoutRepo(process.env.GAME_SCOUT_REPO);
const PYTHON = pythonFor(REPO);
// Which script each button runs. Consoles join when IGDB brings their new games (Phase 2).
const JOBS: Record<string, string> = { steam: "update_steam.py" };
const KEEP_LINES = 200;

/** What the page sees: is it running, and what has it printed so far */
export interface UpdateRun {
  running: boolean;
  started: string | null;
  finished: string | null;
  ok: boolean | null; // null until it ends
  lines: string[]; // finished lines, the last KEEP_LINES
  current: string; // the line being printed right now (progress counters rewrite it in place with "\r")
}

const IDLE: UpdateRun = { running: false, started: null, finished: null, ok: null, lines: [], current: "" };

function start(script: string): UpdateRun {
  const run: UpdateRun = { ...IDLE, running: true, started: new Date().toISOString(), lines: [] };
  if (!existsSync(join(REPO, script))) {
    // Without the repo there's nothing to run: say where it was looked for, instead of a Python error
    const finished = new Date().toISOString();
    return { ...run, running: false, ok: false, finished, lines: [`Game Scout's repo isn't at ${REPO} (set GAME_SCOUT_REPO)`] };
  }
  let rewrite = false; // after "\r" the next text replaces the line instead of adding to it

  const take = (text: string) => {
    for (const part of text.split(/(\r\n|\r|\n)/)) {
      if (part === "\n" || part === "\r\n") {
        run.lines.push(run.current);
        run.current = "";
        rewrite = false;
      } else if (part === "\r") rewrite = true;
      else if (part) {
        run.current = rewrite ? part : run.current + part;
        rewrite = false;
      }
    }
    if (run.lines.length > KEEP_LINES) run.lines.splice(0, run.lines.length - KEEP_LINES);
  };

  const end = (ok: boolean, why?: string) => {
    if (!run.running) return;
    if (run.current) run.lines.push(run.current);
    if (why) run.lines.push(why);
    Object.assign(run, { running: false, ok, current: "", finished: new Date().toISOString() });
  };

  // -u: print each line right away instead of saving them up; utf-8: Japanese text survives the trip
  const child = spawn(PYTHON, ["-u", script], {
    cwd: REPO,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    windowsHide: true,
  });
  child.stdout.setEncoding("utf8").on("data", take);
  child.stderr.setEncoding("utf8").on("data", take);
  child.on("error", (error) => end(false, `Couldn't start Python (${PYTHON}): ${error.message}`));
  child.on("close", (code) => end(code === 0));
  return run;
}

export function dataUpdater(): Plugin {
  const runs = new Map<string, UpdateRun>();
  return {
    name: "games-data-updater",
    apply: "serve", // the dev server only: never part of the built site
    configureServer(server) {
      server.middlewares.use("/__update", (req, res, next) => {
        const job = (req.url ?? "").replace(/^\//, "").split("?")[0];
        if (!JOBS[job] || (req.method !== "GET" && req.method !== "POST")) return next();

        if (req.method === "POST") {
          // Only this site can start an update. Another website open in your browser can't: browsers
          // send its address along (Origin), and they won't send this custom header without asking first.
          const origin = req.headers.origin;
          if (req.headers["x-game-scout"] !== "update" || (origin && new URL(origin).host !== req.headers.host)) {
            res.statusCode = 403;
            return res.end();
          }
          if (!runs.get(job)?.running) runs.set(job, start(JOBS[job]));
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(runs.get(job) ?? IDLE));
      });
    },
  };
}

// The page's side of the "Update now" button: asks the dev server (web/update-plugin.ts) to run
// update_steam.py, then checks on it every 1.5 seconds until it's done and loads the new data.
// Only on your PC while `npm run dev` runs: the built site has no Python behind it.
import type { UpdateRun } from "../../../update-plugin";
import { createStore } from "../state/createStore";
import { reloadData } from "./data";

export type { UpdateRun };

/** true only in `npm run dev`: Vite sets this, and leaves the button out of the built site entirely */
export const CAN_UPDATE = import.meta.env.DEV;

const URL = "/__update/steam";
const POLL_MS = 1500;

export const updateStore = createStore<UpdateRun | null>(null); // null = haven't asked yet
let polling = false;

async function ask(start: boolean): Promise<UpdateRun> {
  const response = await fetch(URL, start ? { method: "POST", headers: { "X-Game-Scout": "update" } } : undefined);
  if (!response.ok) throw new Error(`${URL}: ${response.status}`);
  return response.json();
}

/** The run as the button shows it when the dev server can't be reached (stopped or restarted). */
function unreachable(error: unknown): UpdateRun {
  return {
    running: false,
    started: null,
    finished: new Date().toISOString(),
    ok: false,
    lines: [`Couldn't reach the dev server (${error}). Restart \`npm run dev\` and try again.`],
    current: "",
  };
}

/** Checks on a running update until it ends. If the dev server goes away mid-run, the button says so
 *  (instead of staying greyed out with a frozen bar until the page is reloaded). */
async function follow() {
  if (polling) return; // the Settings page and the sales page can both show the button: one check is enough
  polling = true;
  try {
    let run = updateStore.get();
    while (run?.running) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        run = await ask(false);
      } catch (error) {
        updateStore.set(unreachable(error));
        return;
      }
      updateStore.set(run);
    }
    if (run?.ok) await reloadData();
  } finally {
    polling = false;
  }
}

// Where each of update_steam.py's 4 steps starts, as a share of a whole run. Measured from the button on
// 2026-11-06: step 1 (new games) 3 s -> 141 s, step 2 (both stores) -> 397 s, steps 3 + 4 under a second.
const STEP_STARTS = [0, 0.35, 0.99, 0.995, 1];
const SEARCH_FROM = Date.parse("2023-01-01"); // update_steam.py's SEARCH_FROM: step 1 searches back to here
// Step 1 pages through Steam's newest games 1,000 at a time (one request each, so the count moves evenly
// with time; the date doesn't: far more games came out in 2026 than in 2023). On 2026-11-06 it went
// through 78,000 games; the total grows as Steam adds games, so it's scaled by how much time it covers.
const STEP1_GAMES = 78_000;
const STEP1_MEASURED = Date.parse("2026-11-06");
const STORES = ["US", "JP"]; // asked one after the other in step 2

/** How far the update is, 0 to 1, from what update_steam.py has printed so far:
 *  "1/4 …" + "checked 3,000 games, back to 2025-06-01", "2/4 …" + "US store: 4,000/18,313 games", … */
export function progressOf(lines: string[], now = Date.now()): number {
  let step = 0;
  for (const line of lines) {
    const match = /^([1-4])\/4 /.exec(line);
    if (match) step = Number(match[1]);
  }
  if (!step) return 0;
  const last = lines.at(-1) ?? "";
  let within = 0; // how far into the current step
  if (step === 1) {
    const checked = /checked ([\d,]+) games/.exec(last);
    const expected = (STEP1_GAMES * (now - SEARCH_FROM)) / (STEP1_MEASURED - SEARCH_FROM);
    if (checked) within = Number(checked[1].replace(/,/g, "")) / expected;
  } else if (step === 2) {
    const count = /(US|JP) store: ([\d,]+)\/([\d,]+)/.exec(last);
    if (count) {
      const [done, all] = [count[2], count[3]].map((n) => Number(n.replace(/,/g, "")));
      within = (STORES.indexOf(count[1]) + done / all) / STORES.length;
    }
  }
  within = Math.min(1, Math.max(0, within));
  return STEP_STARTS[step - 1] + within * (STEP_STARTS[step] - STEP_STARTS[step - 1]);
}

/** Minutes left, from the time so far and how far it got. null while it's too early to tell. */
export function minutesLeft(progress: number, elapsedMs: number): number | null {
  if (progress < 0.03) return null;
  return Math.max(0, Math.ceil((elapsedMs / progress - elapsedMs) / 60_000));
}

const RECENT_MS = 10 * 60 * 1000;

/** When a page with the button opens: is an update running (e.g. started from another tab), or did one just end?
 *  The dev server remembers its last run until it restarts; "Updated" from hours ago would just be noise. */
export async function checkUpdate() {
  if (!CAN_UPDATE || updateStore.get()) return;
  try {
    const run = await ask(false);
    const recent = run.finished !== null && Date.now() - Date.parse(run.finished) < RECENT_MS;
    if (!run.running && !recent) return;
    updateStore.set(run);
    if (run.running) await follow();
  } catch {
    // dev server without the plugin (an old one still running): the button just shows as idle
  }
}

export async function startUpdate() {
  try {
    updateStore.set(await ask(true));
  } catch (error) {
    updateStore.set(unreachable(error));
    return;
  }
  await follow();
}

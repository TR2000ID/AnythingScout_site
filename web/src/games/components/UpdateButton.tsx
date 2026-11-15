// "Update now": collects new games, prices and sales from Steam (update_steam.py) and shows how far it got.
// Only on your PC while `npm run dev` runs (see lib/updater.ts). The built site shows nothing here.
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { CAN_UPDATE, checkUpdate, minutesLeft, progressOf, startUpdate, updateStore, type UpdateRun } from "../lib/updater";
import { useStore } from "../state/createStore";
import { useTexts } from "../state/settings";

export function UpdateButton() {
  return CAN_UPDATE ? <Updater /> : null;
}

/** Milliseconds since the update started, ticking every second while it runs */
function useElapsed(run: UpdateRun | null) {
  const [now, setNow] = useState(Date.now());
  const running = !!run?.running;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return run?.started ? Math.max(0, now - Date.parse(run.started)) : 0;
}

/** 187000 ms → "3:07" */
function clock(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Updater() {
  const t = useTexts();
  const run = useStore(updateStore);
  const elapsed = useElapsed(run);
  useEffect(() => void checkUpdate(), []);

  const lines = run ? [...run.lines, run.current].filter((line) => line.trim()) : [];
  // The script prints its steps as "2/4 Prices, sales…" and its progress under them
  const step = [...lines].reverse().find((line) => /^\d\/\d /.test(line));
  const progress = lines.at(-1);
  const share = progressOf(lines);
  const left = minutesLeft(share, elapsed);

  return (
    <div className="updater">
      <button className="button" disabled={run?.running} onClick={() => void startUpdate()}>
        <RefreshCw size={15} className={run?.running ? "spin" : undefined} />
        {run?.running ? t.update.running(clock(elapsed)) : t.update.button}
      </button>
      {run?.running && (
        <div className="updater-status" aria-live="polite">
          <div
            className="updater-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
          >
            <div style={{ width: `${share * 100}%` }} />
          </div>
          <div className="updater-numbers">
            <span>{Math.round(share * 100)}%</span>
            <span>{left === null ? t.update.estimating : t.update.left(left)}</span>
          </div>
          {step && <div>{step}</div>}
          {progress && progress !== step && <div className="updater-progress">{progress.trim()}</div>}
        </div>
      )}
      {run && !run.running && run.ok === true && (
        <div className="updater-status" aria-live="polite">
          {t.update.done(progress ?? "")}
        </div>
      )}
      {run && !run.running && run.ok === false && (
        <div className="updater-status updater-failed" role="alert">
          {t.update.failed}
          <pre>{lines.slice(-4).join("\n")}</pre>
        </div>
      )}
    </div>
  );
}

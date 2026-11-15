// The one-time copy of your Game Scout ratings: /games/carry#<data> (see lib/carry.ts). Writes them exactly as
// they were saved, checks they read back the same, and never replaces different ratings without asking.
import { useEffect, useState } from "react";
import { countRatings, decodeCarry, planCarry, type CarryData } from "../lib/carry";
import { useTexts } from "../state/settings";
import { hrefOf } from "../state/ui";

const RATINGS = "game-scout.ratings";
const SETTINGS = "game-scout.settings";

type Outcome = "none" | "same" | "ask" | "kept" | "done" | "failed";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Write both keys, then read them back: anything but an exact match counts as failed */
function write(data: CarryData): boolean {
  try {
    localStorage.setItem(RATINGS, data.ratings);
    if (data.settings !== null) localStorage.setItem(SETTINGS, data.settings);
    return read(RATINGS) === data.ratings && (data.settings === null || read(SETTINGS) === data.settings);
  } catch {
    return false;
  }
}

// Read once when the page opens, then take the data out of the address so it doesn't sit in the history.
// Kept, because React may run a state's first value twice (StrictMode): the second run must not find an
// empty address and report "no ratings".
interface Arrived {
  data: CarryData | null;
  outcome: Outcome;
  copied?: number; // after the reload that follows a copy: how many arrived
}
let arrived: Arrived | null = null;
const arriveOnce = () => (arrived ??= arrive());

/** The site's ratings and settings were read into memory when it loaded, before this page wrote new ones.
 *  Load the page again (as /games/carry?copied=N) so everything reads the copied ones: otherwise the next
 *  rating made in this tab would save the old in-memory list over them. */
function reloadWith(data: CarryData): Outcome {
  if (!write(data)) return "failed";
  location.replace(`${hrefOf("carry")}?copied=${countRatings(data.ratings)}`);
  return "done";
}

function arrive(): Arrived {
  const copied = new URLSearchParams(location.search).get("copied");
  if (!location.hash && copied !== null) return { data: null, outcome: "done", copied: Number(copied) || 0 };
  const data = decodeCarry(location.hash);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  if (!data) return { data, outcome: "none" };
  const plan = planCarry(data, read(RATINGS));
  if (plan === "write") return { data, outcome: reloadWith(data) };
  return { data, outcome: plan };
}

export function Carry() {
  const t = useTexts();
  const [{ data, outcome, copied }, setState] = useState<Arrived>(arriveOnce);
  // A link opened in a tab that's already on this page only changes the part after #: read it again
  useEffect(() => {
    const again = () => {
      if (!location.hash) return;
      arrived = null;
      setState(arriveOnce());
    };
    window.addEventListener("hashchange", again);
    return () => window.removeEventListener("hashchange", again);
  }, []);
  const incoming = data ? countRatings(data.ratings) : (copied ?? 0);

  return (
    <section className="prose-page prose">
      <h1>{t.carry.title}</h1>
      {outcome === "none" && <p>{t.carry.none}</p>}
      {outcome === "same" && <p>{t.carry.same(incoming)}</p>}
      {outcome === "kept" && <p>{t.carry.kept}</p>}
      {outcome === "failed" && <p className="notice-error">{t.carry.failed}</p>}
      {outcome === "ask" && data && (
        <>
          <p>{t.carry.ask(countRatings(read(RATINGS)), incoming)}</p>
          <div className="section-actions">
            <button className="button" onClick={() => setState({ data, outcome: reloadWith(data) })}>
              {t.carry.replace}
            </button>
            <button className="button" onClick={() => setState({ data, outcome: "kept" })}>
              {t.carry.keep}
            </button>
          </div>
        </>
      )}
      {outcome === "done" && <p>{t.carry.done(incoming)}</p>}
      {(outcome === "done" || outcome === "same") && (
        // A full page load (not the in-site link handling), so the ratings and settings are read again
        <p>
          <a className="button" href={hrefOf("liked")} onClick={(e) => (e.preventDefault(), location.assign(hrefOf("liked")))}>
            {t.carry.open}
          </a>
        </p>
      )}
    </section>
  );
}

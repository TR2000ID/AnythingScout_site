// "New episodes calendar": the shows you like (or found okay) that are airing now, as an .ics file.
import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { buildIcs, download, fetchAiring } from "../lib/calendar";
import { dataStore } from "../lib/data";
import { useStore } from "../state/createStore";
import { useRatings } from "../state/ratings";
import { useSettings, useTexts } from "../state/settings";
import { showToast } from "../state/ui";

export function CalendarButton() {
  const t = useTexts();
  const { titles } = useSettings();
  const ratings = useRatings();
  const catalog = useStore(dataStore).catalog;
  const [busy, setBusy] = useState(false);

  async function make() {
    if (!catalog) return;
    const mals = [...ratings.values()]
      .filter((r) => r.rating === "loved" || r.rating === "liked" || r.rating === "okay")
      .map((r) => catalog.byKey.get(r.show)?.mal)
      .filter((m): m is number => !!m);
    if (!mals.length) return showToast(t.calendar.none);
    setBusy(true);
    try {
      const airing = await fetchAiring(mals, titles === "ja");
      if (!airing.length) return showToast(t.calendar.none);
      download("anime-scout-new-episodes.ics", buildIcs(airing, t.calendar.episodeFrom));
      showToast(t.calendar.done(airing.length));
    } catch {
      showToast(t.calendar.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="button" onClick={() => void make()} disabled={busy} title={t.calendar.hint}>
      <CalendarPlus size={15} />
      {busy ? t.loading : t.calendar.button}
    </button>
  );
}

// The sidebar's choices for For you: how to recommend, popular ↔ hidden gems, and filters.
// Picking one from another page takes you to For you, so you see what it changed.
import { useMemo } from "react";
import { dataStore } from "../lib/data";
import type { Mode } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { DEFAULTS, filterCount, updateSettings, useSettings, useTexts, type Settings, type ShowType } from "../state/settings";
import { showPicks } from "../state/ui";

function choose(change: Partial<Settings>) {
  updateSettings(change);
  showPicks();
}

/** A round radio mark: an empty ring, or a ring with a dot when chosen */
function Dot({ on }: { on: boolean }) {
  return <span className={`radio-dot${on ? " is-on" : ""}`} aria-hidden />;
}

export function ModePicker() {
  const t = useTexts();
  const { mode } = useSettings();
  const modes: Mode[] = ["fans", "tags"];
  return (
    <div className="side-section" role="radiogroup" aria-labelledby="side-mode">
      <div className="side-label" id="side-mode">
        {t.side.mode}
      </div>
      {modes.map((m) => {
        const on = mode === m;
        return (
          <button key={m} role="radio" aria-checked={on} className={`option option-tall${on ? " is-on" : ""}`} onClick={() => choose({ mode: m })}>
            <Dot on={on} />
            <span className="option-text">
              <span className="option-name">{t.modes[m]}</span>
              <span className="option-hint">{t.side.modeHints[m]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Popular ↔ hidden gems: how hard to push less-known shows up (the math is in recommend.ts) */
export function GemsSlider() {
  const t = useTexts();
  const { gems } = useSettings();
  return (
    <div className="side-section">
      <label className="side-label" htmlFor="gems">
        {t.side.gems}
      </label>
      <input
        id="gems"
        className="gems-slider"
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={gems}
        onChange={(e) => choose({ gems: Number(e.target.value) })}
        aria-valuetext={`${Math.round(gems * 100)}%`}
      />
      <div className="gems-ends" aria-hidden>
        <span>{t.side.gemsLow}</span>
        <span>{t.side.gemsHigh}</span>
      </div>
    </div>
  );
}

/** Years aired and the type of show. Shown once the shows have loaded (the years come from them). */
export function FiltersPanel() {
  const t = useTexts();
  const { filters } = useSettings();
  const catalog = useStore(dataStore).catalog;

  const years = useMemo(() => {
    const list: number[] = [];
    if (!catalog) return list;
    let min = Infinity;
    let max = -Infinity;
    for (const s of catalog.shows) if (s.year) [min, max] = [Math.min(min, s.year), Math.max(max, s.year)];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  }, [catalog]);

  if (!catalog) return null;
  const setYear = (which: "from" | "to", value: string) => choose({ filters: { ...filters, [which]: value ? Number(value) : null } });
  const types: ShowType[] = ["all", "tv", "movie", "other"];

  return (
    <div className="side-section">
      <div className="side-label side-label-row">
        <span>{t.filters.button}</span>
        {filterCount(filters) > 0 && (
          <button className="side-reset" onClick={() => choose({ filters: DEFAULTS.filters })}>
            {t.filters.reset}
          </button>
        )}
      </div>
      <div className="field-label">{t.filters.aired}</div>
      <div className="year-range">
        <select value={filters.from ?? ""} onChange={(e) => setYear("from", e.target.value)} aria-label={t.filters.from}>
          <option value="">{t.filters.any}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="year-dash">–</span>
        <select value={filters.to ?? ""} onChange={(e) => setYear("to", e.target.value)} aria-label={t.filters.to}>
          <option value="">{t.filters.any}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="field-label">{t.filters.type}</div>
      <div className="year-range">
        <select value={filters.type} onChange={(e) => choose({ filters: { ...filters, type: e.target.value as ShowType } })} aria-label={t.filters.type}>
          {types.map((ty) => (
            <option key={ty} value={ty}>
              {t.filters.types[ty]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

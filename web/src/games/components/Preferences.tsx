// The sidebar's choices for For you and Steam sales: which platform, how to recommend, and filters.
// Picking one from another page takes you to For you, so you see what it changed.
import { useMemo } from "react";
import { dataStore } from "../lib/data";
import { modeFor, modesOf, PLATFORMS, platformById, type Mode } from "../platforms";
import { useStore } from "../state/createStore";
import { DEFAULTS, filterCount, updateSettings, useSettings, useTexts, type Settings } from "../state/settings";
import { showPicks, usePage } from "../state/ui";

function choose(change: Partial<Settings>) {
  updateSettings(change);
  showPicks(change.platform);
}

/** A round radio mark: an empty ring, or a ring with a dot when chosen */
function Dot({ on }: { on: boolean }) {
  return <span className={`radio-dot${on ? " is-on" : ""}`} aria-hidden />;
}

export function PlatformPicker() {
  const t = useTexts();
  const { platform } = useSettings();
  const { platforms, status } = useStore(dataStore);

  return (
    <div className="side-section" role="radiogroup" aria-labelledby="side-platform">
      <div className="side-label" id="side-platform">
        {t.side.platform}
      </div>
      {PLATFORMS.map((p) => {
        const on = platform === p.id;
        const soon = status !== "loading" && !platforms[p.id];
        return (
          <button
            key={p.id}
            role="radio"
            aria-checked={on}
            className={`option${on ? " is-on" : ""}`}
            onClick={() => choose({ platform: p.id })}
          >
            <Dot on={on} />
            <span className="option-name">{p.name}</span>
            {soon && <span className="option-tag">{t.forYou.soonTag}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ModePicker() {
  const t = useTexts();
  const settings = useSettings();
  const info = useStore(dataStore).platforms[settings.platform];
  const platform = platformById[settings.platform];
  const current = modeFor(platform, settings.mode, info);
  const available = modesOf(platform, info);
  const modes: Mode[] = ["players", "tags"];

  return (
    <div className="side-section" role="radiogroup" aria-labelledby="side-mode">
      <div className="side-label" id="side-mode">
        {t.side.mode}
      </div>
      {modes.map((m) => {
        const on = current === m;
        const here = available.includes(m);
        // Switch will never have player data; PlayStation and Xbox get tags later (Phase 2)
        const hint = here ? t.side.modeHints[m] : platform.modes.includes(m) ? t.side.notYet(platform.name) : t.side.notOn(platform.name);
        return (
          <button
            key={m}
            role="radio"
            aria-checked={on}
            disabled={!here}
            className={`option option-tall${on ? " is-on" : ""}`}
            onClick={() => choose({ mode: m })}
          >
            <Dot on={on} />
            <span className="option-text">
              <span className="option-name">{t.modes[m]}</span>
              <span className="option-hint">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Release years and Japanese support. Shown once the platform's games have loaded (the years come from them). */
export function FiltersPanel() {
  const t = useTexts();
  const { platform, filters } = useSettings();
  const catalog = useStore(dataStore).catalogs[platform];
  const onSalesPage = usePage() === "sales"; // everything there is on sale already

  const years = useMemo(() => {
    const list: number[] = [];
    if (!catalog) return list;
    let min = Infinity;
    let max = -Infinity;
    for (const g of catalog.games) [min, max] = [Math.min(min, g.year), Math.max(max, g.year)];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  }, [catalog]);

  if (!catalog) return null;

  const setYear = (which: "from" | "to", value: string) =>
    choose({ filters: { ...filters, [which]: value ? Number(value) : null } });

  return (
    <div className="side-section">
      <div className="side-label side-label-row">
        <span>{t.filters.button}</span>
        {filterCount(filters, !!catalog.info.prices) > 0 && (
          <button className="side-reset" onClick={() => choose({ filters: DEFAULTS.filters })}>
            {t.filters.reset}
          </button>
        )}
      </div>
      <div className="field-label">{t.filters.released}</div>
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
      {!!catalog.info.flags.japanese && (
        <label className="check">
          <input
            type="checkbox"
            checked={filters.japanese}
            onChange={(e) => choose({ filters: { ...filters, japanese: e.target.checked } })}
          />
          <span>{t.filters.japanese}</span>
        </label>
      )}
      {filters.japanese && catalog.info.languages_partial && <div className="field-hint">{t.filters.japanesePartial}</div>}
      {!!catalog.info.prices && !onSalesPage && (
        <label className="check">
          <input
            type="checkbox"
            checked={filters.onSale}
            onChange={(e) => choose({ filters: { ...filters, onSale: e.target.checked } })}
          />
          <span>{t.filters.onSale}</span>
        </label>
      )}
    </div>
  );
}

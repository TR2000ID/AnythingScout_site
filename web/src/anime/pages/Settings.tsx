// Settings: site language, show titles, where-to-watch region, your ratings, and what the data covers.
import { dataStore } from "../lib/data";
import { useStore } from "../state/createStore";
import { clearRatings, useRatings } from "../state/ratings";
import { updateSettings, useSettings, useTexts, type Lang, type Region } from "../state/settings";

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([option, name]) => (
        <button key={option} role="radio" aria-checked={value === option} className={value === option ? "is-on" : ""} onClick={() => onChange(option)}>
          {name}
        </button>
      ))}
    </div>
  );
}

const LANGS: [Lang, string][] = [
  ["en", "English"],
  ["ja", "日本語"],
];

export function Settings() {
  const t = useTexts();
  const settings = useSettings();
  const ratings = useRatings();
  const { catalog } = useStore(dataStore);
  const regions: [Region, string][] = [
    ["jp", t.settings.regionJp],
    ["global", t.settings.regionGlobal],
  ];

  return (
    <section className="prose-page">
      <h1>{t.settings.title}</h1>

      <div className="setting">
        <div>
          <div className="setting-label">{t.settings.language}</div>
          <div className="setting-hint">{t.settings.languageHint}</div>
        </div>
        <Choice value={settings.lang} options={LANGS} label={t.settings.language} onChange={(lang) => updateSettings({ lang })} />
      </div>

      <div className="setting">
        <div>
          <div className="setting-label">{t.settings.titles}</div>
          <div className="setting-hint">{t.settings.titlesHint}</div>
        </div>
        <Choice value={settings.titles} options={LANGS} label={t.settings.titles} onChange={(titles) => updateSettings({ titles })} />
      </div>

      <div className="setting">
        <div>
          <div className="setting-label">{t.settings.region}</div>
          <div className="setting-hint">{t.settings.regionHint}</div>
        </div>
        <Choice value={settings.region} options={regions} label={t.settings.region} onChange={(region) => updateSettings({ region })} />
      </div>

      <div className="setting">
        <div>
          <div className="setting-label">{t.settings.ratings}</div>
          <div className="setting-hint">{t.settings.ratingsHint(ratings.size)}</div>
        </div>
        <button className="button button-danger" disabled={!ratings.size} onClick={() => window.confirm(t.settings.confirmRemove) && clearRatings()}>
          {t.settings.removeAll}
        </button>
      </div>

      {catalog && (
        <div className="setting setting-stack">
          <div>
            <div className="setting-label">{t.settings.data}</div>
            <div className="setting-hint">
              {t.settings.dataText(
                catalog.meta.scores_until,
                catalog.meta.cards.toLocaleString(settings.lang),
                catalog.meta.linked.toLocaleString(settings.lang),
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

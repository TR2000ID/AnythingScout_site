// Settings: site language, game titles, Steam store, your ratings, and how fresh the data is
// (with the "Update now" button while `npm run dev` runs on your PC).
import { Choice } from "../components/Choice";
import { UpdateButton } from "../components/UpdateButton";
import { dataStore, type Store } from "../lib/data";
import { formatWhen } from "../lib/format";
import { CAN_UPDATE } from "../lib/updater";
import { PLATFORMS } from "../platforms";
import { useStore } from "../state/createStore";
import { clearRatings, useRatings } from "../state/ratings";
import { updateSettings, useSettings, useTexts, type Lang } from "../state/settings";

const LANGS: [Lang, string][] = [
  ["en", "English"],
  ["ja", "日本語"],
];

export function Settings() {
  const t = useTexts();
  const settings = useSettings();
  const ratings = useRatings();
  const { platforms } = useStore(dataStore);
  const steam = platforms.steam;
  const stores: [Store, string][] = [
    ["us", t.settings.storeUs],
    ["jp", t.settings.storeJp],
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
          <div className="setting-label">{t.settings.store}</div>
          <div className="setting-hint">{t.settings.storeHint}</div>
        </div>
        <Choice value={settings.store} options={stores} label={t.settings.store} onChange={(store) => updateSettings({ store })} />
      </div>

      <div className="setting">
        <div>
          <div className="setting-label">{t.settings.ratings}</div>
          <div className="setting-hint">{t.settings.ratingsHint(ratings.size)}</div>
        </div>
        <button
          className="button button-danger"
          disabled={!ratings.size}
          onClick={() => window.confirm(t.settings.confirmRemove) && clearRatings()}
        >
          {t.settings.removeAll}
        </button>
      </div>

      <div className="setting setting-stack">
        <div>
          <div className="setting-label">{t.settings.data}</div>
          {steam && (
            <div className="setting-hint">
              {t.settings.dataSteam(steam.players_data_until, formatWhen(steam.updated, settings.lang))}
              {settings.lang === "ja" ? "" : " "}
              {t.settings.dataDaily}
            </div>
          )}
          {PLATFORMS.map(({ id, name }) => {
            const info = platforms[id];
            if (!info?.players) return null; // consoles only
            return (
              <div key={id} className="setting-hint">
                {t.settings.dataConsole(name, info.players.toLocaleString(settings.lang), t.progress[id], info.players_data_until)}
              </div>
            );
          })}
          <div className="setting-hint">{t.settings.dataSoon}</div>
          {CAN_UPDATE && <div className="setting-hint setting-hint-gap">{t.update.hint}</div>}
        </div>
        <UpdateButton />
      </div>
    </section>
  );
}

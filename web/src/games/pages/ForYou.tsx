// For you: your picks for the platform chosen in the sidebar (or "coming soon" if it has no data yet).
// The sidebar holds the choices (platform, how to recommend, filters); this page just shows the results.
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { GameCard } from "../components/GameCard";
import { dataStore, type Catalog } from "../lib/data";
import { popular, recommend } from "../lib/recommend";
import { modeFor, modesOf, platformById, type Platform } from "../platforms";
import { useStore } from "../state/createStore";
import { tiersOf, useRatings } from "../state/ratings";
import { DEFAULTS, filterCount, passes, updateSettings, useSettings, useTexts } from "../state/settings";
import { hrefOf, menuStore, useIsNarrow } from "../state/ui";

const PAGE_SIZE = 24;

export function ForYou() {
  const { platform: platformId } = useSettings();
  const { catalogs, platforms, status } = useStore(dataStore);
  const platform = platformById[platformId];
  const catalog = catalogs[platformId];
  const t = useTexts();

  let body;
  if (catalog) body = <Picks key={platform.id} platform={platform} catalog={catalog} />;
  else if (status === "error") body = <p className="notice">{t.loadError}</p>;
  else if (status === "loading" && (platforms[platformId] || !Object.keys(platforms).length))
    body = <p className="notice">{t.loading}</p>;
  else body = <ComingSoon platform={platform} />;

  return (
    <>
      {useIsNarrow() && <PhoneChoices />}
      {body}
    </>
  );
}

/** Phones: the sidebar is tucked away, so this button shows what's chosen and opens it (also on Steam sales) */
export function PhoneChoices() {
  const t = useTexts();
  const settings = useSettings();
  const info = useStore(dataStore).platforms[settings.platform];
  const platform = platformById[settings.platform];
  const count = filterCount(settings.filters, !!info?.prices);
  return (
    <button className={`chip phone-choices${count ? " is-on" : ""}`} onClick={() => menuStore.set(true)}>
      <SlidersHorizontal size={15} />
      <span>
        {platform.name} · {t.modes[modeFor(platform, settings.mode, info)]}
      </span>
      {count > 0 && <span className="chip-count">{count}</span>}
    </button>
  );
}

function Picks({ platform, catalog }: { platform: Platform; catalog: Catalog }) {
  const t = useTexts();
  const settings = useSettings();
  const ratings = useRatings();
  const [shown, setShown] = useState(PAGE_SIZE);
  const mode = modeFor(platform, settings.mode, catalog.info);
  const { filters, store } = settings;

  const tiers = useMemo(() => tiersOf(ratings), [ratings]);
  const allowed = useMemo(() => passes(filters, store), [filters, store]);
  const result = useMemo(() => recommend(catalog, tiers, mode, allowed), [catalog, tiers, mode, allowed]);

  const waitingForLinks = mode === "players" && !catalog.neighbors;
  const starting = result.liked === 0;
  const starters = useMemo(
    () => (starting ? popular(catalog, tiers, allowed).slice(0, PAGE_SIZE) : []),
    [starting, catalog, tiers, allowed],
  );

  if (starting) {
    return (
      <section>
        <header className="section-head">
          <div>
            <h1>{t.forYou.startTitle}</h1>
            <p className="lead">{result.rated > 0 ? t.forYou.needLike : t.forYou.startBody}</p>
          </div>
        </header>
        <div className="subhead">
          <h2>{t.forYou.popular(platform.name)}</h2>
        </div>
        <div className="grid">
          {starters.map((game, i) => (
            <GameCard key={game.key} game={game} eager={i < 12} />
          ))}
        </div>
      </section>
    );
  }

  const picks = result.picks.slice(0, shown);
  const { info } = catalog;
  const until = info.players_data_until.slice(0, 7);
  const lang = settings.lang;
  let note =
    mode === "tags"
      ? t.forYou.noteTags
      : info.players // consoles: libraries and trophies, not reviews
        ? `${t.forYou.noteConsole(platform.name, info.players.toLocaleString(lang), t.progress[platform.id], until)} ${t.forYou.tagsLater(platform.name)}`
        : t.forYou.notePlayers(until);
  if (modesOf(platform, info).length === 1 && mode === "tags") note = t.forYou.onlyTags;

  return (
    <section>
      <header className="section-head">
        <div>
          <h1>{t.forYou.title}</h1>
          <p className="lead">
            {platform.name} · {t.forYou.basedOn(result.rated)} ·{" "}
            <a className="link" href={hrefOf("liked")}>
              {t.forYou.edit}
            </a>
          </p>
        </div>
      </header>
      <p className="note">{note}</p>

      {waitingForLinks ? (
        <p className="notice">{t.loading}</p>
      ) : picks.length === 0 ? (
        <div className="empty">
          <p>{t.forYou.noMatches}</p>
          <button className="button" onClick={() => updateSettings({ filters: DEFAULTS.filters })}>
            {t.forYou.clearFilters}
          </button>
        </div>
      ) : (
        <>
          <div className="grid">
            {picks.map(({ game, match }, i) => (
              <GameCard key={game.key} game={game} match={match} reason={result.reasonFor(game)} eager={i < 12} />
            ))}
          </div>
          {result.picks.length > shown && (
            <div className="more">
              <button className="button" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                {t.forYou.showMore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ComingSoon({ platform }: { platform: Platform }) {
  const t = useTexts();
  const body = t.forYou.soonBody[platform.id as keyof typeof t.forYou.soonBody];
  return (
    <section className="soon">
      <h1>{t.forYou.soonTitle(platform.name)}</h1>
      <p>{body}</p>
      <p className="soon-foot">{t.forYou.soonFoot}</p>
    </section>
  );
}

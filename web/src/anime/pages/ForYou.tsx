// For you: your picks. The sidebar holds the choices (mode, hidden gems, filters); this page shows the results.
// Until you've rated GOAL shows, well-known ones to rate stay on top: with fewer ratings, the plain list of
// the most famous shows is hard to beat (Phase 1's accuracy test: ~10 to tie, 20 to clearly win).
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ImportButton } from "../components/ImportDialog";
import { ShowCard } from "../components/ShowCard";
import { dataStore, type Catalog } from "../lib/data";
import { popular, recommend } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { tiersOf, useRatings } from "../state/ratings";
import { DEFAULTS, filterCount, gemsPower, passes, updateSettings, useSettings, useTexts } from "../state/settings";
import { hrefOf, menuStore, useIsNarrow } from "../state/ui";

const PAGE_SIZE = 24;
export const GOAL = 10; // ratings before the start grid steps aside
const STARTERS = 12;

export function ForYou() {
  const { catalog, status } = useStore(dataStore);
  const t = useTexts();
  let body;
  if (catalog) body = <Picks catalog={catalog} />;
  else if (status === "error") body = <p className="notice">{t.loadError}</p>;
  else body = <p className="notice">{t.loading}</p>;
  return (
    <>
      {useIsNarrow() && <PhoneChoices />}
      {body}
    </>
  );
}

/** Phones: the sidebar is tucked away, so this button shows what's chosen and opens it */
export function PhoneChoices() {
  const t = useTexts();
  const settings = useSettings();
  const count = filterCount(settings.filters) + (settings.gems > 0 ? 1 : 0);
  return (
    <button className={`chip phone-choices${count ? " is-on" : ""}`} onClick={() => menuStore.set(true)}>
      <SlidersHorizontal size={15} />
      <span>{t.modes[settings.mode]}</span>
      {count > 0 && <span className="chip-count">{count}</span>}
    </button>
  );
}

function Picks({ catalog }: { catalog: Catalog }) {
  const t = useTexts();
  const settings = useSettings();
  const ratings = useRatings();
  const [shown, setShown] = useState(PAGE_SIZE);
  const { filters, mode, gems } = settings;

  const tiers = useMemo(() => tiersOf(ratings), [ratings]);
  const allowed = useMemo(() => passes(filters), [filters]);
  const result = useMemo(() => recommend(catalog, tiers, mode, allowed, gemsPower(gems)), [catalog, tiers, mode, allowed, gems]);
  const starters = useMemo(() => popular(catalog, tiers, () => true).slice(0, result.liked ? STARTERS : PAGE_SIZE), [catalog, tiers, result.liked]);

  const startGrid = (
    <>
      <div className="subhead">
        <h2>{t.forYou.popular}</h2>
        <span className="subhead-note">{t.forYou.progress(Math.min(result.rated, GOAL), GOAL)}</span>
      </div>
      <div className="grid">
        {starters.map((show, i) => (
          <ShowCard key={show.key} show={show} eager={i < 12} />
        ))}
      </div>
    </>
  );

  if (result.liked === 0) {
    return (
      <section>
        <header className="section-head">
          <div>
            <h1>{t.forYou.startTitle}</h1>
            <p className="lead">{result.rated > 0 ? t.forYou.needLike : t.forYou.startBody}</p>
          </div>
          <ImportButton />
        </header>
        {startGrid}
      </section>
    );
  }

  const waitingForLinks = mode === "fans" && !catalog.neighbors;
  const picks = result.picks.slice(0, shown);
  const note = mode === "tags" ? t.forYou.noteTags : t.forYou.noteFans(catalog.meta.scores_until);

  return (
    <section>
      <header className="section-head">
        <div>
          <h1>{t.forYou.title}</h1>
          <p className="lead">
            {t.forYou.basedOn(result.rated)} ·{" "}
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
            {picks.map(({ show, match }, i) => (
              <ShowCard key={show.key} show={show} match={match} reason={result.reasonFor(show)} eager={i < 12} />
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

      {result.rated < GOAL && <div className="start-strip">{startGrid}</div>}
    </section>
  );
}

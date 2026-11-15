// Steam sales: every Steam game on sale today in your store, best match for your taste first, then the rest.
// Prices come from update_steam.py (daily). A sale that ended since then shows the normal price, so it drops out.
// The sidebar's "Recommend by" and filters work here too.
import { useEffect, useMemo, useState } from "react";
import { Choice } from "../components/Choice";
import { GameCard } from "../components/GameCard";
import { UpdateButton } from "../components/UpdateButton";
import { dataStore, type Catalog, type Game } from "../lib/data";
import { formatWhen } from "../lib/format";
import { recommend } from "../lib/recommend";
import { modeFor, platformById } from "../platforms";
import { useStore } from "../state/createStore";
import { tiersOf, useRatings } from "../state/ratings";
import { DEFAULTS, isOnSale, passes, priceOf, settingsStore, updateSettings, useSettings, useTexts } from "../state/settings";
import { hrefOf, useIsNarrow } from "../state/ui";
import { PhoneChoices } from "./ForYou";

const PAGE_SIZE = 24;
const MIN_CUTS = [0, 25, 50, 75]; // "Any", 25%+, 50%+, 75%+
type Sort = "match" | "discount" | "popular";

export function Sales() {
  const t = useTexts();
  const { catalogs, status } = useStore(dataStore);
  const catalog = catalogs.steam;
  // You're looking at Steam, so opening this page switches the sidebar to Steam too (its filters and
  // "Recommend by" apply here). Only on opening: picking another platform here takes you to For you.
  useEffect(() => {
    if (settingsStore.get().platform !== "steam") updateSettings({ platform: "steam" });
  }, []);

  return (
    <>
      {useIsNarrow() && <PhoneChoices />}
      {catalog?.pricesUpdated ? (
        <SaleList catalog={catalog} updated={catalog.pricesUpdated} />
      ) : (
        <section>
          <header className="section-head">
            <h1>{t.sales.title}</h1>
            <UpdateButton />
          </header>
          <p className="notice">{status === "error" ? t.loadError : catalog ? t.sales.noPrices : t.loading}</p>
        </section>
      )}
    </>
  );
}

function SaleList({ catalog, updated }: { catalog: Catalog; updated: string }) {
  const t = useTexts();
  const settings = useSettings();
  const { store, lang, filters } = settings;
  const ratings = useRatings();
  const [minCut, setMinCut] = useState(0);
  const [sortPicked, setSort] = useState<Sort>("match");
  const [shown, setShown] = useState(PAGE_SIZE);
  const mode = modeFor(platformById.steam, settings.mode, catalog.info);

  const tiers = useMemo(() => tiersOf(ratings), [ratings]);
  const allowed = useMemo(() => {
    const filtered = passes({ ...filters, onSale: true }, store);
    return (game: Game) => filtered(game) && (priceOf(game, store)?.discount ?? 0) >= minCut;
  }, [filters, store, minCut]);
  const result = useMemo(() => recommend(catalog, tiers, mode, allowed), [catalog, tiers, mode, allowed]);
  const hasTaste = result.liked > 0;
  const sort: Sort = sortPicked === "match" && !hasTaste ? "discount" : sortPicked;

  const onSaleTotal = useMemo(() => catalog.games.filter((g) => isOnSale(g, store)).length, [catalog, store]);
  const list = useMemo(() => {
    const match = new Map(result.picks.map((p) => [p.game.row, p.match]));
    const cut = (g: Game) => priceOf(g, store)?.discount ?? 0;
    const mostReviewed = (a: Game, b: Game) => b.popularity - a.popularity;
    // never what you've rated or hidden (you've played it), never a game today's hardware can't run
    const games = catalog.games.filter((g) => allowed(g) && !tiers.has(g.key) && !g.rateOnly);
    if (sort === "match") games.sort((a, b) => (match.get(b.row) ?? -1) - (match.get(a.row) ?? -1) || mostReviewed(a, b));
    else if (sort === "discount") games.sort((a, b) => cut(b) - cut(a) || mostReviewed(a, b));
    else games.sort(mostReviewed);
    return games.map((game) => ({ game, match: match.get(game.row) }));
  }, [catalog, allowed, tiers, result, sort, store]);

  useEffect(() => setShown(PAGE_SIZE), [sort, minCut, store, filters]); // a new list starts at the top

  const sorts: Sort[] = hasTaste ? ["match", "discount", "popular"] : ["discount", "popular"];
  const sortNote = sort === "match" ? t.sales.noteMatch(t.modes[mode]) : t.sales.noteSort[sort];
  const waitingForLinks = sort === "match" && mode === "players" && !catalog.neighbors;

  return (
    <section>
      <header className="section-head">
        <div>
          <h1>{t.sales.title}</h1>
          <p className="lead">
            {t.sales.lead(onSaleTotal.toLocaleString(lang), t.price.store[store], formatWhen(updated, lang))} ·{" "}
            <a className="link" href={hrefOf("settings")}>
              {t.sales.changeStore}
            </a>
          </p>
        </div>
        <UpdateButton />
      </header>

      <div className="sales-bar">
        <Choice
          value={minCut}
          options={MIN_CUTS.map((m) => [m, m ? t.sales.atLeast(m) : t.sales.anyCut])}
          onChange={setMinCut}
          label={t.sales.minLabel}
        />
        <Choice value={sort} options={sorts.map((s) => [s, t.sales.sort[s]])} onChange={setSort} label={t.sales.sortLabel} />
      </div>
      <p className="note">
        {[sortNote, hasTaste ? "" : t.sales.noteNoTaste, t.sales.noteStale].filter(Boolean).join(lang === "ja" ? "" : " ")}
      </p>

      {waitingForLinks ? (
        <p className="notice">{t.loading}</p>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>{t.sales.none}</p>
          <button
            className="button"
            onClick={() => {
              setMinCut(0);
              updateSettings({ filters: DEFAULTS.filters });
            }}
          >
            {t.forYou.clearFilters}
          </button>
        </div>
      ) : (
        <>
          <div className="grid">
            {list.slice(0, shown).map(({ game, match }, i) => (
              <GameCard
                key={game.key}
                game={game}
                match={match}
                reason={match !== undefined ? result.reasonFor(game) : null}
                eager={i < 12}
              />
            ))}
          </div>
          {list.length > shown && (
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

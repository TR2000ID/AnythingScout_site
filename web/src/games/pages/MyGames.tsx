// My games: your ratings from every platform, newest first, in four lists (tabs):
// Liked (Loved + Liked), Okay, Disliked and Hidden.
import { GameCard } from "../components/GameCard";
import { dataStore, findGame, type Game } from "../lib/data";
import type { Tier } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { setRating, useRatings } from "../state/ratings";
import { useTexts } from "../state/settings";
import { hrefOf, MY_GAMES, type MyGamesList } from "../state/ui";

const GROUPS: Record<MyGamesList, Tier[]> = {
  liked: ["loved", "liked"],
  okay: ["okay"],
  disliked: ["disliked"],
  hidden: ["hidden"],
};

export function MyGames({ which }: { which: MyGamesList }) {
  const t = useTexts();
  const ratings = useRatings();
  const { catalogs, status } = useStore(dataStore);
  const tiers = GROUPS[which];
  const names = { liked: t.rated.likedTitle, okay: t.rated.okayTitle, disliked: t.rated.dislikedTitle, hidden: t.rated.hiddenTitle };
  const emptyText = { liked: t.rated.likedEmpty, okay: t.rated.okayEmpty, disliked: t.rated.dislikedEmpty, hidden: t.rated.hiddenEmpty }[which];

  // Once the games are loaded, count only the ones that can be shown: a rated game that's no longer
  // in the data (e.g. a new game the daily update dropped) would make "3" sit above an empty list.
  const ready = status === "ready";
  const shown = (key: string) => !ready || findGame(catalogs, key) !== undefined;
  const counts = { liked: 0, okay: 0, disliked: 0, hidden: 0 };
  for (const { game, rating } of ratings.values())
    for (const list of MY_GAMES) if (GROUPS[list].includes(rating) && shown(game)) counts[list]++;

  const byTier = new Map<Tier, Game[]>(tiers.map((tier) => [tier, []]));
  const rows = [...ratings.values()].filter((r) => tiers.includes(r.rating)).sort((a, b) => b.at.localeCompare(a.at));
  const missing: string[] = [];
  for (const row of rows) {
    const game = findGame(catalogs, row.game);
    if (game) byTier.get(row.rating)!.push(game);
    else if (ready) missing.push(row.game);
  }

  return (
    <section>
      <header className="section-head">
        <h1>{t.rated.title}</h1>
      </header>

      <nav className="tabs">
        {MY_GAMES.map((list) => (
          <a
            key={list}
            href={hrefOf(list)}
            className={`tab${list === which ? " is-current" : ""}`}
            aria-current={list === which ? "page" : undefined}
          >
            {names[list]}
            <span className="tab-count">{counts[list]}</span>
          </a>
        ))}
      </nav>

      {!ready && rows.length > 0 && <p className="lead">{t.loading}</p>}
      {(ready || !rows.length) && rows.length === missing.length && <p className="lead">{emptyText}</p>}
      {missing.length > 0 && (
        <p className="lead">
          {t.rated.missing(missing.length)}{" "}
          <button type="button" className="text-button" onClick={() => missing.forEach((key) => setRating(key, null))}>
            {t.rated.removeMissing}
          </button>
        </p>
      )}
      {tiers.map((tier) => {
        const games = byTier.get(tier)!;
        if (!games.length) return null;
        return (
          <div key={tier} className="group">
            {tiers.length > 1 && (
              <h2 className="group-title">
                {t.tiers[tier]} <span className="group-count">{games.length}</span>
              </h2>
            )}
            <div className="grid">
              {games.map((game) => (
                <GameCard key={game.key} game={game} showPlatform canHide={false} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

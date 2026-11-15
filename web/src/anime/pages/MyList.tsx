// My list: your ratings, newest first, in four lists (tabs):
// Liked (Loved + Liked), Okay, Disliked and Hidden.
import { CalendarButton } from "../components/CalendarButton";
import { ImportButton } from "../components/ImportDialog";
import { ShowCard } from "../components/ShowCard";
import { dataStore, type Show } from "../lib/data";
import type { Tier } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { useRatings } from "../state/ratings";
import { useTexts } from "../state/settings";
import { hrefOf, MY_LIST, type MyListName } from "../state/ui";

const GROUPS: Record<MyListName, Tier[]> = {
  liked: ["loved", "liked"],
  okay: ["okay"],
  disliked: ["disliked"],
  hidden: ["hidden"],
};

export function MyList({ which }: { which: MyListName }) {
  const t = useTexts();
  const ratings = useRatings();
  const { catalog } = useStore(dataStore);
  const tiers = GROUPS[which];
  const names = { liked: t.rated.likedTitle, okay: t.rated.okayTitle, disliked: t.rated.dislikedTitle, hidden: t.rated.hiddenTitle };
  const emptyText = { liked: t.rated.likedEmpty, okay: t.rated.okayEmpty, disliked: t.rated.dislikedEmpty, hidden: t.rated.hiddenEmpty }[which];

  const counts = { liked: 0, okay: 0, disliked: 0, hidden: 0 };
  for (const { rating } of ratings.values())
    for (const list of MY_LIST) if (GROUPS[list].includes(rating)) counts[list]++;

  const byTier = new Map<Tier, Show[]>(tiers.map((tier) => [tier, []]));
  const rows = [...ratings.values()].filter((r) => tiers.includes(r.rating)).sort((a, b) => b.at.localeCompare(a.at));
  for (const row of rows) {
    const show = catalog?.byKey.get(row.show);
    if (show) byTier.get(row.rating)!.push(show);
  }

  return (
    <section>
      <header className="section-head">
        <h1>{t.rated.title}</h1>
        <div className="section-actions">
          <CalendarButton />
          <ImportButton />
        </div>
      </header>

      <nav className="tabs">
        {MY_LIST.map((list) => (
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

      {!rows.length && <p className="lead">{emptyText}</p>}
      {tiers.map((tier) => {
        const shows = byTier.get(tier)!;
        if (!shows.length) return null;
        return (
          <div key={tier} className="group">
            {tiers.length > 1 && (
              <h2 className="group-title">
                {t.tiers[tier]} <span className="group-count">{shows.length}</span>
              </h2>
            )}
            <div className="grid">
              {shows.map((show) => (
                <ShowCard key={show.key} show={show} canHide={false} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

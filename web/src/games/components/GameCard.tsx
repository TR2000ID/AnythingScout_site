// One game in a grid: cover, title, year and score, price (Steam), why it was picked, and Rate / Hide.
import type { Game } from "../lib/data";
import type { Reason } from "../lib/recommend";
import { platformById } from "../platforms";
import { altTitleOf, consolesOf, titleOf, useSettings, useTexts } from "../state/settings";
import { openDetails } from "../state/ui";
import { Cover } from "./Cover";
import { PriceTag } from "./PriceTag";
import { HideButton, RateMenu } from "./RateMenu";
import { useReasonText } from "./reasonText";

interface Props {
  game: Game;
  match?: number;
  reason?: Reason | null;
  showPlatform?: boolean; // on My games pages, where games from every platform are mixed
  canHide?: boolean;
  eager?: boolean;
}

export function GameCard({ game, match, reason = null, showPlatform = false, canHide = true, eager }: Props) {
  const t = useTexts();
  const { titles } = useSettings();
  const title = titleOf(game, titles);
  const why = useReasonText(reason, "short");
  const open = () => openDetails(game.key, reason, match ?? null);

  return (
    <article className="card">
      <button className="card-cover" onClick={open} aria-label={title}>
        <Cover game={game} title={title} eager={eager} />
        {match !== undefined && <span className="match-badge">{t.match(Math.round(match * 100))}</span>}
      </button>
      <div className="card-body">
        <button className="card-title" onClick={open} title={altTitleOf(game, titles) ?? title}>
          {title}
        </button>
        <div className="card-meta">
          {showPlatform && <span className="platform-label">{platformById[game.platform].name}</span>}
          <span>
            {game.positive !== null ? t.meta(game.year, game.positive) : t.metaConsoles(game.year, consolesOf(game, t))}
          </span>
        </div>
        {game.prices && (
          <div className="card-price">
            <PriceTag game={game} />
          </div>
        )}
        {why && (
          <div className="card-reason" title={why}>
            {why}
          </div>
        )}
        <div className="card-actions">
          <RateMenu game={game} />
          {canHide && <HideButton game={game} />}
        </div>
      </div>
    </article>
  );
}

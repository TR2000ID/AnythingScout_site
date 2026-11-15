// One show in a grid: cover, title, type and season, why it was picked, other versions, and Rate / Hide.
import { dataStore, type Show } from "../lib/data";
import type { Reason } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { altTitleOf, titleOf, useSettings, useTexts } from "../state/settings";
import { openDetails } from "../state/ui";
import { Cover } from "./Cover";
import { HideButton, RateMenu } from "./RateMenu";
import { useReasonText } from "./reasonText";
import { useMetaLine } from "./ShowDialog";

interface Props {
  show: Show;
  match?: number;
  reason?: Reason | null;
  canHide?: boolean;
  eager?: boolean;
  note?: string; // instead of "why this?" (watch together: how well it suits each person)
}

export function ShowCard({ show, match, reason = null, canHide = true, eager, note }: Props) {
  const t = useTexts();
  const { titles } = useSettings();
  const catalog = useStore(dataStore).catalog;
  const title = titleOf(show, titles);
  const why = useReasonText(reason, "short") ?? note ?? null;
  const meta = useMetaLine(show);
  const open = () => openDetails(show.key, reason, match ?? null);
  const versions = catalog ? show.versions.map((r) => titleOf(catalog.shows[r], titles)) : [];

  return (
    <article className="card">
      <button className="card-cover" onClick={open} aria-label={title}>
        <Cover show={show} title={title} eager={eager} />
        {match !== undefined && <span className="match-badge">{t.match(Math.round(match * 100))}</span>}
        {show.isNew && (
          <span className="new-badge" title={t.newHint}>
            {t.newBadge}
          </span>
        )}
      </button>
      <div className="card-body">
        <button className="card-title" onClick={open} title={altTitleOf(show, titles) ?? title}>
          {title}
        </button>
        <div className="card-meta">
          <span>{meta}</span>
        </div>
        {why && (
          <div className="card-reason" title={why}>
            {why}
          </div>
        )}
        {versions.length > 0 && (
          <div className="card-versions" title={t.versions(versions.join(", "))}>
            {t.versions(versions.join(", "))}
          </div>
        )}
        <div className="card-actions">
          <RateMenu show={show} />
          {canHide && <HideButton show={show} />}
        </div>
      </div>
    </article>
  );
}

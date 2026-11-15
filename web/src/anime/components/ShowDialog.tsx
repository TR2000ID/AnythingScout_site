// The details popup: opens from any cover, title or search result.
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, EyeOff, X } from "lucide-react";
import { dataStore, type Show } from "../lib/data";
import { formatSeason } from "../lib/format";
import { TIERS } from "../lib/recommend";
import { rate } from "../state/actions";
import { useStore } from "../state/createStore";
import { useRatings } from "../state/ratings";
import { altTitleOf, titleOf, useSettings, useTexts } from "../state/settings";
import { detailsStore, openDetails } from "../state/ui";
import { tileTint } from "./Cover";
import { TIER_ICON } from "./RateMenu";
import { useReasonText } from "./reasonText";
import { WhereToWatch } from "./WhereToWatch";

export function ShowDialog() {
  const details = useStore(detailsStore);
  const { catalog } = useStore(dataStore);
  const show = details && catalog ? catalog.byKey.get(details.key) : undefined;
  return (
    <Dialog.Root open={!!show} onOpenChange={(open) => !open && detailsStore.set(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {show && details && <DialogBody key={show.key} show={show} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** "TV · Fall 2023 · 28 eps": the line under the title on cards and in the popup */
export function useMetaLine(show: Show): string {
  const t = useTexts();
  const { lang } = useSettings();
  return [show.type ? (t.types[show.type] ?? show.type) : "", formatSeason(show.year, show.season, lang), show.episodes && show.episodes > 1 ? t.episodes(show.episodes) : ""]
    .filter(Boolean)
    .join(" · ");
}

function DialogBody({ show }: { show: Show }) {
  const t = useTexts();
  const { titles, lang } = useSettings();
  const details = useStore(detailsStore)!;
  const catalog = useStore(dataStore).catalog!;
  const current = useRatings().get(show.key)?.rating;
  const why = useReasonText(details.reason, "long");
  const meta = useMetaLine(show);
  const title = titleOf(show, titles);
  const alt = altTitleOf(show, titles);
  const versions = show.versions.map((r) => catalog.shows[r]);

  return (
    <Dialog.Content className="dialog" aria-describedby={undefined}>
      <div className="dialog-art">
        {show.cover ? (
          <img src={show.cover} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="dialog-art-empty" style={{ background: tileTint(show.title) }} />
        )}
      </div>
      <Dialog.Close className="icon-button dialog-close" aria-label={t.dialog.close}>
        <X size={18} />
      </Dialog.Close>

      <div className="dialog-body">
        <Dialog.Title className="dialog-title">{title}</Dialog.Title>
        {alt && <div className="dialog-alt">{alt}</div>}
        <div className="dialog-meta">
          {meta && <span>{meta}</span>}
          {show.popularity > 0 && <span>{t.dialog.people(show.popularity.toLocaleString(lang))}</span>}
        </div>
        {show.isNew && <p className="dialog-note">{t.dialog.newShow}</p>}

        {why && (
          <section className="dialog-why">
            <h3>
              {t.dialog.why}
              {details.match !== null && <span className="dialog-match">{t.match(Math.round(details.match * 100))}</span>}
            </h3>
            <p>{why}</p>
          </section>
        )}

        <div className="tier-buttons" role="group" aria-label={t.rate}>
          {TIERS.map((tier) => {
            const Icon = TIER_ICON[tier];
            const on = current === tier;
            return (
              <button key={tier} className={`tier-button${on ? " is-on" : ""}`} aria-pressed={on} title={t.tiers[tier]} onClick={() => rate(show, on ? null : tier)}>
                <Icon size={17} className={`tier-icon tier-${tier}`} />
                <span>{t.tierShort[tier]}</span>
              </button>
            );
          })}
        </div>

        <div className="dialog-actions">
          <button className="text-button" onClick={() => rate(show, current === "hidden" ? null : "hidden")} title={t.hideHint}>
            <EyeOff size={15} />
            {current === "hidden" ? t.unhide : t.hide}
          </button>
          {show.mal && (
            <div className="dialog-buy">
              <a className="button" href={`https://myanimelist.net/anime/${show.mal}`} target="_blank" rel="noreferrer">
                MyAnimeList
                <ExternalLink size={14} />
              </a>
              <a className="button" href={`https://anilist.co/search/anime?search=${encodeURIComponent(show.title)}`} target="_blank" rel="noreferrer">
                AniList
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        <WhereToWatch show={show} />

        {versions.length > 0 && (
          <section className="dialog-tags">
            <h3>{t.dialog.versions}</h3>
            <div className="tag-list">
              {versions.map((v) => (
                <button key={v.key} className="tag tag-link" onClick={() => openDetails(v.key)}>
                  {titleOf(v, titles)}
                  {v.year ? ` (${v.year})` : ""}
                </button>
              ))}
            </div>
          </section>
        )}

        {show.genres.length > 0 && (
          <section className="dialog-tags">
            <h3>{t.dialog.genres}</h3>
            <div className="tag-list">
              {show.genres.map((g) => (
                <span key={g} className="tag">
                  {g}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </Dialog.Content>
  );
}

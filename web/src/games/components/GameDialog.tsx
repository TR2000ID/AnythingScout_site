// The details popup: opens from any cover, title or search result.
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, EyeOff, X } from "lucide-react";
import { dataStore, findGame } from "../lib/data";
import { TIERS } from "../lib/recommend";
import { platformById } from "../platforms";
import { rate } from "../state/actions";
import { useStore } from "../state/createStore";
import { useRatings } from "../state/ratings";
import { altTitleOf, titleOf, useSettings, useTexts } from "../state/settings";
import { detailsStore } from "../state/ui";
import { tileTint } from "./Cover";
import { PriceTag } from "./PriceTag";
import { TIER_ICON } from "./RateMenu";
import { useReasonText } from "./reasonText";

export function GameDialog() {
  const details = useStore(detailsStore);
  const { catalogs } = useStore(dataStore);
  const game = details ? findGame(catalogs, details.key) : undefined;

  return (
    <Dialog.Root open={!!game} onOpenChange={(open) => !open && detailsStore.set(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {game && details && <DialogBody key={game.key} gameKey={game.key} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogBody({ gameKey }: { gameKey: string }) {
  const t = useTexts();
  const { titles, lang } = useSettings();
  const details = useStore(detailsStore)!;
  const catalogs = useStore(dataStore).catalogs;
  const game = findGame(catalogs, gameKey)!;
  const catalog = catalogs[game.platform]!;
  const current = useRatings().get(game.key)?.rating;
  const why = useReasonText(details.reason, "long");
  const platform = platformById[game.platform];
  const title = titleOf(game, titles);
  const alt = altTitleOf(game, titles);

  const tags = [];
  for (let k = catalog.tagStart[game.row]; k < catalog.tagStart[game.row + 1] && tags.length < 12; k++)
    tags.push(catalog.tagNames[lang][catalog.tagIds[k]]);

  return (
    <Dialog.Content className="dialog" aria-describedby={undefined}>
      <div className="dialog-art">
        {game.header || game.poster ? (
          <img src={game.header ?? game.poster!} alt="" />
        ) : (
          <div className="dialog-art-empty" style={{ background: tileTint(game.title) }} />
        )}
      </div>
      <Dialog.Close className="icon-button dialog-close" aria-label={t.dialog.close}>
        <X size={18} />
      </Dialog.Close>

      <div className="dialog-body">
        <Dialog.Title className="dialog-title">{title}</Dialog.Title>
        {alt && <div className="dialog-alt">{alt}</div>}
        <div className="dialog-meta">
          <span>
            {platform.name} ({game.consoles ?? platform.consoles})
          </span>
          <span>{game.year}</span>
          <span>
            {game.positive !== null
              ? t.dialog.reviews(game.positive, game.popularity.toLocaleString(lang))
              : t.dialog.players(game.popularity.toLocaleString(lang))}
          </span>
          {game.japanese && <span>{t.dialog.japanese}</span>}
        </div>
        {game.rateOnly && <p className="dialog-note">{t.dialog.rateOnly[game.platform]?.(game.consoles ?? "")}</p>}
        {game.backcompat && <p className="dialog-note">{t.dialog.backcompat}</p>}

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
              <button
                key={tier}
                className={`tier-button${on ? " is-on" : ""}`}
                aria-pressed={on}
                title={t.tiers[tier]}
                onClick={() => rate(game, on ? null : tier)}
              >
                <Icon size={17} className={`tier-icon tier-${tier}`} />
                <span>{t.tierShort[tier]}</span>
              </button>
            );
          })}
        </div>

        <div className="dialog-actions">
          <button
            className="text-button"
            onClick={() => rate(game, current === "hidden" ? null : "hidden")}
            title={t.hideHint}
          >
            <EyeOff size={15} />
            {current === "hidden" ? t.unhide : t.hide}
          </button>
          {!game.rateOnly && (
            <div className="dialog-buy">
              {game.prices && <PriceTag game={game} long />}
              <a className="button" href={platform.storeUrl(game)} target="_blank" rel="noreferrer">
                {t.dialog.store(platform.store)}
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <section className="dialog-tags">
            <h3>{t.dialog.tags}</h3>
            <div className="tag-list">
              {tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </Dialog.Content>
  );
}

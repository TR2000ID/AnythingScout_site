// A Steam game's price in your store (Settings → Steam prices): "$19.99", or "−40% $20.99 $12.59" on sale.
// Nothing for games without price data (consoles).
import type { Game } from "../lib/data";
import { formatDay, formatPrice } from "../lib/format";
import { priceOf, useSettings, useTexts } from "../state/settings";

export function PriceTag({ game, long = false }: { game: Game; long?: boolean }) {
  const t = useTexts();
  const { store, lang } = useSettings();
  const price = priceOf(game, store);
  if (price === undefined) return null;
  if (price === null) return <span className="price price-none">{t.price.notSold(t.price.store[store])}</span>;

  const ends = long && price.ends ? t.price.ends(formatDay(price.ends, lang)) : null;
  return (
    <span className="price">
      {price.discount > 0 && (
        <>
          <span className="price-cut">−{price.discount}%</span>
          <s className="price-base">{formatPrice(price.base, store)}</s>
        </>
      )}
      <span className="price-now">{price.now === 0 ? t.price.free : formatPrice(price.now, store)}</span>
      {ends && <span className="price-ends">{ends}</span>}
    </span>
  );
}

// A game's cover. Tries the tall cover first, then the wide one, then shows the title on a plain tile.
// PlayStation and Xbox have no covers until Phase 2 (IGDB), so their whole grid is title tiles.
import { useState } from "react";
import type { Game } from "../lib/data";

/** A quiet background for a title tile: dark and nearly grey, with a faint hue picked from the title,
 *  so a grid of tiles is easier to scan without adding loud colors. The same title always gets the same hue. */
export function tileTint(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(165deg, hsl(${hue} 16% 19%), hsl(${hue} 10% 11%))`;
}

export function Cover({ game, title, eager = false }: { game: Game; title: string; eager?: boolean }) {
  const sources = [game.poster, game.header].filter((s): s is string => !!s);
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];

  if (!src) {
    return (
      <div className="cover cover-empty" style={{ background: tileTint(game.title) }}>
        <span>{title}</span>
      </div>
    );
  }
  const wide = src === game.header; // wide art sits in the middle of the tall frame
  return (
    <div className={wide ? "cover cover-wide" : "cover"}>
      {wide && <img className="cover-blur" src={src} alt="" aria-hidden loading={eager ? "eager" : "lazy"} />}
      <img
        key={src}
        src={src}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setAttempt((a) => a + 1)}
      />
    </div>
  );
}

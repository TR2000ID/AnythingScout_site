// A show's cover, or its title on a plain tile when there's no cover (or it doesn't load).
import { useState } from "react";
import type { Show } from "../lib/data";

/** A quiet background for a title tile: dark and nearly grey, with a faint hue picked from the title,
 *  so a grid of tiles is easier to scan without adding loud colors. The same title always gets the same hue. */
export function tileTint(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(165deg, hsl(${hue} 16% 19%), hsl(${hue} 10% 11%))`;
}

export function Cover({ show, title, eager = false }: { show: Show; title: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!show.cover || failed) {
    return (
      <div className="cover cover-empty" style={{ background: tileTint(show.title) }}>
        <span>{title}</span>
      </div>
    );
  }
  return (
    <div className="cover">
      <img
        key={show.cover}
        src={show.cover}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

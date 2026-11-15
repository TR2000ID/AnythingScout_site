// The "Rate ⌄" menu on cards and in search: Loved / Liked / Okay / Didn't like, plus Remove.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, EyeOff, Heart, Meh, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import type { Show } from "../lib/data";
import { TIERS, type Tier } from "../lib/recommend";
import { rate } from "../state/actions";
import { useRatings } from "../state/ratings";
import { useTexts } from "../state/settings";

export const TIER_ICON: Record<Tier, LucideIcon> = {
  loved: Heart,
  liked: ThumbsUp,
  okay: Meh,
  disliked: ThumbsDown,
  hidden: EyeOff,
};

export function RateMenu({ show, compact = false }: { show: Show; compact?: boolean }) {
  const t = useTexts();
  const current = useRatings().get(show.key)?.rating;
  const Icon = current ? TIER_ICON[current] : null;

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={`rate-trigger${current ? " is-rated" : ""}${compact ? " is-compact" : ""}`}>
        {Icon && <Icon size={15} className={`tier-icon tier-${current}`} />}
        <span>{current ? t.tierShort[current] : t.rate}</span>
        <ChevronDown size={14} className="chevron" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="start" sideOffset={6} onClick={(e) => e.stopPropagation()}>
          {TIERS.map((tier) => {
            const TierIcon = TIER_ICON[tier];
            return (
              <Menu.Item key={tier} className="menu-item" onSelect={() => rate(show, tier)}>
                <TierIcon size={16} className={`tier-icon tier-${tier}`} />
                <span>{t.tiers[tier]}</span>
                {current === tier && <Check size={15} className="menu-check" />}
              </Menu.Item>
            );
          })}
          {current && (
            <>
              <Menu.Separator className="menu-separator" />
              <Menu.Item className="menu-item" onSelect={() => rate(show, null)}>
                <span className="menu-item-plain">{current === "hidden" ? t.unhide : t.removeRating}</span>
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The eye button on cards: hide a show without changing your taste */
export function HideButton({ show }: { show: Show }) {
  const t = useTexts();
  return (
    <button className="icon-button" onClick={() => rate(show, "hidden")} title={t.hideHint} aria-label={t.hide}>
      <EyeOff size={16} />
    </button>
  );
}

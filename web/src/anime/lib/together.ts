// Watch together: one set of picks for several people. Each person's picks are worked out on their own
// (the same math as For you), scaled so their best match is 1, then averaged. A show that leaves anyone
// cold (under FLOOR for them) is dropped: a group pick should be one nobody has to sit through.
// Shows anyone has rated are left out too: someone has seen it.
import type { Catalog, Show } from "./data";
import { byFans, byTags, matches, split, type Mode, type Tier } from "./recommend";

export interface Person {
  name: string;
  tiers: Map<string, Tier>;
}

export interface GroupPick {
  show: Show;
  match: number; // the group's average, 0-0.99
  each: { name: string; match: number }[];
}

const FLOOR = 0.15;

export function groupPicks(
  catalog: Catalog,
  people: Person[],
  mode: Mode,
  allowed: (show: Show) => boolean,
  gems = 0,
): GroupPick[] | null {
  const n = catalog.shows.length;
  const seen = new Set<number>();
  const perPerson: Float64Array[] = [];
  for (const person of people) {
    const { liked, rated } = split(catalog, person.tiers);
    rated.forEach((r) => seen.add(r));
    if (!liked.length) continue; // nothing liked yet: they don't steer the picks
    const result = mode === "fans" ? byFans(catalog, liked) : byTags(catalog, liked);
    if (!result) return null; // links still loading
    perPerson.push(matches(catalog, result.scores, rated, gems)); // the same % as on their For you page
  }
  if (!perPerson.length) return [];
  const steering = people.filter((p) => split(catalog, p.tiers).liked.length);

  const picks: GroupPick[] = [];
  for (let r = 0; r < n; r++) {
    if (seen.has(r) || !allowed(catalog.shows[r])) continue;
    let sum = 0;
    let low = Infinity;
    for (const s of perPerson) {
      sum += s[r];
      low = Math.min(low, s[r]);
    }
    if (low < FLOOR) continue;
    picks.push({
      show: catalog.shows[r],
      match: Math.min(sum / perPerson.length, 0.99),
      each: steering.map((p, i) => ({ name: p.name, match: Math.min(perPerson[i][r], 0.99) })),
    });
  }
  return picks.sort((a, b) => b.match - a.match);
}

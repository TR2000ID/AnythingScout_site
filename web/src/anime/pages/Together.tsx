// Watch together: you + friends → picks for all of you. Friends come from their AniList username or a
// MyAnimeList export file, and are remembered in this browser only (nothing is sent anywhere).
import { Upload, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ShowCard } from "../components/ShowCard";
import { dataStore, type Catalog } from "../lib/data";
import { cardRatings, fetchAniList, ImportError, readMalFile, type ListEntry } from "../lib/importList";
import type { Tier } from "../lib/recommend";
import { groupPicks, type Person } from "../lib/together";
import { createStore, loadSaved, save, useStore } from "../state/createStore";
import { tiersOf, useRatings } from "../state/ratings";
import { gemsPower, passes, useSettings, useTexts } from "../state/settings";

interface Friend {
  name: string;
  ratings: Record<string, Tier>; // card key → rating
}

const KEY = "anime-scout.friends";
/** Saved friends we can use: a name and an object of ratings (anything else in storage is skipped). */
const isFriend = (f: unknown): f is Friend =>
  typeof f === "object" && f !== null && typeof (f as Friend).name === "string" &&
  typeof (f as Friend).ratings === "object" && (f as Friend).ratings !== null;
const saved = loadSaved<unknown>(KEY);
const friendsStore = createStore<Friend[]>(Array.isArray(saved) ? saved.filter(isFriend) : []);
friendsStore.subscribe(() => save(KEY, friendsStore.get()));

const PAGE_SIZE = 24;

/** A list → card ratings, kept as a plain object so it can be saved with the friend */
const toCards = (catalog: Catalog, entries: ListEntry[]): Record<string, Tier> =>
  Object.fromEntries(cardRatings(catalog, entries).cards);

export function Together() {
  const t = useTexts();
  const { catalog } = useStore(dataStore);
  if (!catalog) return <p className="notice">{t.loading}</p>;
  return <TogetherPage catalog={catalog} />;
}

function TogetherPage({ catalog }: { catalog: Catalog }) {
  const t = useTexts();
  const settings = useSettings();
  const friends = useStore(friendsStore);
  const mine = useRatings();
  const [withMe, setWithMe] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);

  const people: Person[] = useMemo(() => {
    const list = friends.map((f) => ({ name: f.name, tiers: new Map(Object.entries(f.ratings)) }));
    return withMe ? [{ name: t.together.you, tiers: tiersOf(mine) }, ...list] : list;
  }, [friends, mine, withMe, t]);
  const allowed = useMemo(() => passes(settings.filters), [settings.filters]);
  const picks = useMemo(
    () => (people.length >= 2 ? groupPicks(catalog, people, settings.mode, allowed, gemsPower(settings.gems)) : []),
    [catalog, people, settings.mode, settings.gems, allowed],
  );

  return (
    <section>
      <header className="section-head">
        <div>
          <h1>{t.together.title}</h1>
          <p className="lead">{t.together.intro}</p>
        </div>
      </header>

      <div className="people">
        <label className="person">
          <input type="checkbox" checked={withMe} onChange={(e) => setWithMe(e.target.checked)} />
          <span>{t.together.you}</span>
          <span className="person-count">{t.together.rated(mine.size)}</span>
        </label>
        {friends.map((f) => (
          <div className="person" key={f.name}>
            <span>{f.name}</span>
            <span className="person-count">{t.together.rated(Object.keys(f.ratings).length)}</span>
            <button className="icon-button" aria-label={t.together.remove(f.name)} onClick={() => friendsStore.set((all) => all.filter((x) => x !== f))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <AddFriend catalog={catalog} />

      {people.length < 2 ? (
        <p className="note">{t.together.needTwo}</p>
      ) : picks === null ? (
        <p className="notice">{t.loading}</p>
      ) : picks.length === 0 ? (
        <p className="note">{t.together.none}</p>
      ) : (
        <>
          <p className="note">{t.together.note}</p>
          <div className="grid">
            {picks.slice(0, shown).map(({ show, match, each }, i) => (
              <ShowCard key={show.key} show={show} match={match} note={each.map((e) => `${e.name} ${Math.round(e.match * 100)}%`).join(" · ")} eager={i < 12} />
            ))}
          </div>
          {picks.length > shown && (
            <div className="more">
              <button className="button" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                {t.forYou.showMore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AddFriend({ catalog }: { catalog: Catalog }) {
  const t = useTexts();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(name: string, get: () => Promise<ListEntry[]>) {
    setBusy(true);
    setError("");
    try {
      const ratings = toCards(catalog, await get());
      friendsStore.set((all) => [...all.filter((f) => f.name !== name), { name, ratings }]);
      setUsername("");
    } catch (e) {
      setError(e instanceof ImportError ? t.import.errors[e.code] : t.import.errors.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add-friend">
      <form
        className="import-row"
        onSubmit={(e) => {
          e.preventDefault();
          const name = username.trim();
          if (name) void add(name, () => fetchAniList(name));
        }}
      >
        <input className="text-input" placeholder={t.import.username} aria-label={t.together.addAniList} value={username} onChange={(e) => setUsername(e.target.value)} />
        <button className="button" type="submit" disabled={busy || !username.trim()}>
          <UserPlus size={15} />
          {t.together.add}
        </button>
        <label className="button file-button">
          <Upload size={15} />
          {t.together.addFile}
          <input
            type="file"
            accept=".xml,.gz"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void add(file.name.replace(/\.xml(\.gz)?$/, "").replace(/^animelist_\d+_-_\d+_/, ""), () => readMalFile(file));
              e.target.value = "";
            }}
          />
        </label>
      </form>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

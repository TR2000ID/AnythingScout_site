// "Import your list": from AniList (username) or MyAnimeList (the export file). Shows what it found, then
// adds it. Shows you already rated by hand keep your rating; the import only fills in the rest.
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Upload, X } from "lucide-react";
import { useState } from "react";
import { dataStore, type Catalog } from "../lib/data";
import { cardRatings, fetchAniList, ImportError, readMalFile, type ListEntry } from "../lib/importList";
import type { Tier } from "../lib/recommend";
import { useStore } from "../state/createStore";
import { ratingsStore, setRatings } from "../state/ratings";
import { useTexts } from "../state/settings";
import { showToast } from "../state/ui";

interface Found {
  rows: { show: string; rating: Tier }[]; // new ratings, one per card
  kept: number; // cards you'd already rated: left as they are
  missing: number; // entries the site doesn't have (adult titles, music videos, shows with too few scores)
  counts: Record<Tier, number>;
}

/** List entries → the new ratings to add (one per card), leaving cards you already rated alone */
export function plan(catalog: Catalog, entries: ListEntry[]): Found {
  const { cards: best, missing } = cardRatings(catalog, entries);
  const current = ratingsStore.get();
  const rows = [...best].filter(([key]) => !current.has(key)).map(([show, rating]) => ({ show, rating }));
  const counts = { loved: 0, liked: 0, okay: 0, disliked: 0, hidden: 0 } as Record<Tier, number>;
  for (const r of rows) counts[r.rating]++;
  return { rows, kept: best.size - rows.length, missing, counts };
}

export function ImportButton() {
  const t = useTexts();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="button">
        <Download size={15} />
        {t.import.button}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {open && <ImportBody onDone={() => setOpen(false)} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImportBody({ onDone }: { onDone: () => void }) {
  const t = useTexts();
  const catalog = useStore(dataStore).catalog;
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<Found | null>(null);

  // The buttons wait for the anime data: on a slow connection a list picked before it arrived used to do nothing
  async function load(get: () => Promise<ListEntry[]>) {
    if (!catalog) return;
    setBusy(true);
    setError("");
    setFound(null);
    try {
      setFound(plan(catalog, await get()));
    } catch (e) {
      setError(e instanceof ImportError ? t.import.errors[e.code] : t.import.errors.network);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!found) return;
    setRatings(found.rows);
    showToast(t.import.done(found.rows.length));
    onDone();
  }

  return (
    <Dialog.Content className="dialog dialog-small" aria-describedby={undefined}>
      <Dialog.Close className="icon-button dialog-close" aria-label={t.dialog.close}>
        <X size={18} />
      </Dialog.Close>
      <div className="dialog-body">
        <Dialog.Title className="dialog-title">{t.import.title}</Dialog.Title>
        <p className="dialog-note">{t.import.intro}</p>

        <section className="import-way">
          <h3>AniList</h3>
          <form
            className="import-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (username.trim()) void load(() => fetchAniList(username));
            }}
          >
            <input
              className="text-input"
              placeholder={t.import.username}
              aria-label={t.import.username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
            <button className="button" type="submit" disabled={busy || !catalog || !username.trim()}>
              {t.import.fetch}
            </button>
          </form>
        </section>

        <section className="import-way">
          <h3>MyAnimeList</h3>
          <p className="field-hint">{t.import.malHow}</p>
          <label className="button file-button" aria-disabled={!catalog}>
            <Upload size={15} />
            {t.import.chooseFile}
            <input
              type="file"
              accept=".xml,.gz"
              hidden
              disabled={!catalog}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void load(() => readMalFile(file));
                e.target.value = "";
              }}
            />
          </label>
        </section>

        {(busy || !catalog) && <p className="notice">{t.loading}</p>}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {found && (
          <section className="import-found" aria-live="polite">
            <p>{t.import.found(found.rows.length, found.kept, found.missing)}</p>
            <p className="field-hint">{t.import.breakdown(found.counts)}</p>
            <button className="button button-primary" onClick={add} disabled={!found.rows.length}>
              {t.import.add(found.rows.length)}
            </button>
          </section>
        )}
      </div>
    </Dialog.Content>
  );
}

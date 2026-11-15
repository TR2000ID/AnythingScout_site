// "Where to watch" in the details popup. Outside Japan: AniList's streaming links. Japan: the site's own
// server asks TMDB (dアニメストア, U-NEXT, ABEMA ...); until it can (no TMDB key yet), it says so and still
// shows the other links. Settings → Where to watch picks the region.
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProviders, loadWatch, type Provider, type Show, type WatchFile } from "../lib/data";
import { useSettings, useTexts } from "../state/settings";

export function WhereToWatch({ show }: { show: Show }) {
  const t = useTexts();
  const { region } = useSettings();
  const [file, setFile] = useState<WatchFile | null>(null);
  const [japan, setJapan] = useState<{ providers: Provider[]; link: string | null } | null | "loading">("loading");

  useEffect(() => {
    let live = true;
    loadWatch().then((f) => live && setFile(f), () => live && setFile(null));
    return () => {
      live = false;
    };
  }, []);

  const tmdb = file?.tmdb[show.row] ?? null;
  useEffect(() => {
    if (region !== "jp" || !tmdb) return setJapan(null);
    let live = true;
    setJapan("loading");
    fetchProviders(tmdb, "JP").then((answer) => live && setJapan(answer));
    return () => {
      live = false;
    };
  }, [region, tmdb]);

  if (!file) return null;
  const links = file.links[show.row].map(([site, url]) => ({ name: file.sites[site], url }));
  const official = file.official[show.row];
  const japanList = japan && japan !== "loading" ? japan.providers : [];
  if (!links.length && !official && !japanList.length && region !== "jp") return null;

  return (
    <section className="dialog-tags">
      <h3>{t.watch.title}</h3>
      {region === "jp" && (
        <>
          {japan === "loading" && <p className="field-hint">{t.loading}</p>}
          {japanList.length > 0 && (
            <div className="tag-list">
              {japanList.map((p) => (
                <a key={p.name} className="tag tag-link provider" href={japan && japan !== "loading" ? (japan.link ?? undefined) : undefined} target="_blank" rel="noreferrer" title={t.watch.kinds[p.kind]}>
                  {p.logo && <img src={p.logo} alt="" width={18} height={18} />}
                  {p.name}
                  {p.kind !== "flatrate" && <span className="provider-kind">{t.watch.kinds[p.kind]}</span>}
                </a>
              ))}
            </div>
          )}
          {japan !== "loading" && !japanList.length && <p className="field-hint">{japan === null ? t.watch.japanLater : t.watch.japanNone}</p>}
        </>
      )}
      {links.length > 0 && (
        <>
          {region === "jp" && <p className="field-hint">{t.watch.elsewhere}</p>}
          <div className="tag-list">
            {links.map((l) => (
              <a key={l.url} className="tag tag-link" href={l.url} target="_blank" rel="noreferrer">
                {l.name}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </>
      )}
      {official && (
        <p className="field-hint">
          <a className="link" href={official} target="_blank" rel="noreferrer">
            {t.watch.official}
          </a>
        </p>
      )}
      {japanList.length > 0 && <p className="fine-print">{t.watch.credit}</p>}
    </section>
  );
}

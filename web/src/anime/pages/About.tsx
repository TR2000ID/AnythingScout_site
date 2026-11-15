// About: what Anime Scout is, how picks work, where the data comes from, and that it's not affiliated with anyone.
import { useTexts } from "../state/settings";

export function About() {
  const t = useTexts();
  const a = t.about;
  return (
    <section className="prose-page prose">
      <h1>{a.title}</h1>
      <p>{a.intro}</p>

      <h2>{a.howTitle}</h2>
      <p>{a.howFans}</p>
      <p>{a.howTags}</p>
      <p>{a.howRatings}</p>
      <p>{a.howGems}</p>

      <h2>{a.dataTitle}</h2>
      <p>
        {a.dataScores}
        <br />
        {a.dataAnilist}
        <br />
        {a.dataOffline}
        <br />
        {a.dataWatch}
      </p>

      <h2>{a.privacyTitle}</h2>
      <p>{a.privacy}</p>

      <p className="fine-print">{a.notAffiliated}</p>
    </section>
  );
}

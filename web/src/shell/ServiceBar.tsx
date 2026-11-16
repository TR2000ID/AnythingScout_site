// The bar across the top of every page: the site's name, then one tab per section (Games · Anime · Manga & Comics).
// Sections that aren't here yet carry a small "Soon" pill. The language is the section's own setting for now
// (Shell picks it, see barLang in sections.ts; step 3 of the merge makes settings shared across the site).
// The right end is the account spot (account/AccountButton.tsx).
import { AccountButton } from "./account/AccountButton";
import { READY, SECTIONS, useRoute } from "./route";
import { SHELL_TEXTS, SITE_NAME } from "./texts";

export function ServiceBar({ lang }: { lang: "en" | "ja" }) {
  const t = SHELL_TEXTS[lang];
  const current = useRoute()?.section;

  return (
    <header className="service-bar">
      <a className="service-brand" href="/">
        {SITE_NAME}
      </a>
      <nav className="service-tabs" aria-label={t.sections}>
        {SECTIONS.map((section) => (
          <a
            key={section}
            className="service-tab"
            href={`/${section}/`}
            aria-current={section === current ? "page" : undefined}
          >
            <span className="service-name">{t[section]}</span>
            {!READY.includes(section) && <span className="service-soon">{t.soon}</span>}
          </a>
        ))}
      </nav>
      <AccountButton lang={lang} />
    </header>
  );
}

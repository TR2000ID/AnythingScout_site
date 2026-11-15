// The sidebar, top to bottom: search (rate games you've played), then the choices for For you
// (platform, how to recommend, filters), then the pages. On phones the same panel slides in
// from the left (see App.tsx), and the search box sits at the top of the screen instead.
import { BadgePercent, Compass, Info, Library, Settings, X, type LucideIcon } from "lucide-react";
import { useRatings } from "../state/ratings";
import { useTexts } from "../state/settings";
import { hrefOf, menuStore, MY_GAMES, usePage, type Page } from "../state/ui";
import { FiltersPanel, ModePicker, PlatformPicker } from "./Preferences";
import { SearchBar } from "./SearchBar";

export function Logo() {
  return (
    <a className="logo" href={hrefOf("for-you")}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      </svg>
      <span>Game Scout</span>
    </a>
  );
}

function NavLink({ page, icon: Icon, label, count, current }: { page: Page; icon: LucideIcon; label: string; count?: number; current: boolean }) {
  return (
    <a className={`nav-link${current ? " is-current" : ""}`} href={hrefOf(page)} aria-current={current ? "page" : undefined}>
      <Icon size={17} />
      <span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </a>
  );
}

/** `search`: false in the phone menu, where the search box is already at the top of the screen */
export function Sidebar({ search = true }: { search?: boolean }) {
  const t = useTexts();
  const page = usePage();
  const ratings = useRatings();
  let rated = 0; // hidden games aren't counted: they're not an opinion
  for (const { rating } of ratings.values()) if (rating !== "hidden") rated++;

  return (
    <div className="sidebar-inner">
      <div className="side-top">
        <Logo />
        {!search && (
          <button className="icon-button" aria-label={t.nav.closeMenu} onClick={() => menuStore.set(false)}>
            <X size={18} />
          </button>
        )}
      </div>

      {search && (
        <div className="side-section">
          <label className="side-label" htmlFor="search-input">
            {t.side.rate}
          </label>
          <SearchBar />
        </div>
      )}

      <PlatformPicker />
      <ModePicker />
      <FiltersPanel />

      <nav className="nav-group nav-bottom">
        <NavLink page="for-you" icon={Compass} label={t.nav.forYou} current={page === "for-you"} />
        <NavLink page="sales" icon={BadgePercent} label={t.nav.sales} current={page === "sales"} />
        <NavLink
          page="liked"
          icon={Library}
          label={t.nav.myGames}
          count={rated}
          current={(MY_GAMES as readonly Page[]).includes(page)}
        />
        <NavLink page="settings" icon={Settings} label={t.nav.settings} current={page === "settings"} />
        <NavLink page="about" icon={Info} label={t.nav.about} current={page === "about"} />
      </nav>
    </div>
  );
}

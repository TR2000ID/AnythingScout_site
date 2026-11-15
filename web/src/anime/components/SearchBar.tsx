// The search box: top of the sidebar (on phones, top of the screen). Type a show (English, romaji or 日本語),
// rate it right there, or press Enter / click it to open its details. Press / anywhere to jump here.
// The results float over the page (a Radix popover) so they can be wider than the sidebar.
import * as Popover from "@radix-ui/react-popover";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { dataStore } from "../lib/data";
import { search } from "../lib/search";
import { useStore } from "../state/createStore";
import { altTitleOf, titleOf, useSettings, useTexts } from "../state/settings";
import { useMetaLine } from "./ShowDialog";
import type { Show } from "../lib/data";
import { openDetails } from "../state/ui";
import { Cover } from "./Cover";
import { RateMenu } from "./RateMenu";

export function SearchBar() {
  const t = useTexts();
  const { titles } = useSettings();
  const { catalog, status } = useStore(dataStore);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => (catalog ? search(catalog.shows, query, 8) : []), [catalog, query]);

  // "/" jumps to the search box (unless you're already typing somewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !target.closest("input, textarea, select, [contenteditable]")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (index: number) => {
    const show = results[index];
    if (!show) return;
    openDetails(show.key);
    setOpen(false);
    input.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      choose(active);
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else input.current?.blur();
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length > 0;

  return (
    <Popover.Root open={showPanel} onOpenChange={(next) => !next && setOpen(false)}>
      <Popover.Anchor asChild>
        <div className="search" ref={wrapper}>
          <Search size={17} className="search-icon" />
          <input
            ref={input}
            id="search-input"
            className="search-input"
            type="search"
            value={query}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            aria-expanded={showPanel}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {query ? (
            <button
              className="search-clear"
              aria-label={t.search.clear}
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="search-kbd" title={t.search.shortcut}>
              /
            </kbd>
          )}
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          className="search-panel"
          role="listbox"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()} // keep typing in the box
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // clicking or tabbing back into the box itself shouldn't close the results
            if (wrapper.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          {status === "loading" && !catalog && <div className="search-empty">{t.search.loading}</div>}
          {!!catalog && !results.length && <div className="search-empty">{t.search.none(query.trim())}</div>}
          {results.map((show, i) => {
            const title = titleOf(show, titles);
            const alt = altTitleOf(show, titles);
            return (
              <div
                key={show.key}
                className={`search-row${i === active ? " is-active" : ""}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest(".rate-trigger")) choose(i);
                }}
              >
                <div className="search-thumb">
                  <Cover show={show} title={title} />
                </div>
                <div className="search-text">
                  <div className="search-title">{title}</div>
                  <div className="search-meta">
                    {alt && <span className="search-alt">{alt}</span>}
                    <MetaLine show={show} />
                  </div>
                </div>
                <RateMenu show={show} compact />
              </div>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MetaLine({ show }: { show: Show }) {
  return <span>{useMetaLine(show)}</span>;
}

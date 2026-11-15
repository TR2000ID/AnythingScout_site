// The whole site: the service bar on top, then the section the address points at.
// "/" (or an address no section knows) is sent to a section: the last one used, see homeFor() in route.ts.
import { useLayoutEffect } from "react";
import { App as Anime } from "../anime/App";
import { ratingsStore } from "../anime/state/ratings";
import { homeFor, navigate, READY, SECTION_KEY, useRoute } from "./route";
import { ServiceBar } from "./ServiceBar";
import { Soon } from "./Soon";

export { READY };

// Private windows can block storage: then the site just doesn't remember the last section
function savedSection(): string | null {
  try {
    return localStorage.getItem(SECTION_KEY);
  } catch {
    return null;
  }
}

function saveSection(section: string) {
  try {
    localStorage.setItem(SECTION_KEY, section);
  } catch {
    // nothing to do
  }
}

export function Shell() {
  const route = useRoute();

  // Before the screen is drawn, so "/" never flashes an empty page
  useLayoutEffect(() => {
    if (route) saveSection(route.section);
    else navigate(`/${homeFor(savedSection(), READY, ratingsStore.get().size > 0)}/${location.search}`, true);
  }, [route]);

  return (
    <>
      <ServiceBar />
      {route?.section === "anime" && <Anime />}
      {route?.section === "games" && <Soon section="games" />}
      {route?.section === "manga" && <Soon section="manga" />}
    </>
  );
}

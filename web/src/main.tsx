import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadData } from "./anime/lib/data";
import { installLinks, legacyRedirect, navigate } from "./shell/route";
import { Shell } from "./shell/Shell";
import "./anime/styles.css";
import "./shell/shell.css"; // after the section's styles: it moves their sticky parts under the service bar

// Anime Scout's old addresses (…/#/liked) open the same page at its new address (/anime/liked)
const moved = legacyRedirect(location.pathname, location.hash, location.search);
if (moved) navigate(moved, true);
installLinks(); // links inside the site change the page without reloading it

loadData(); // starts downloading the show data while the page draws

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);

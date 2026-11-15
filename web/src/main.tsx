import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./anime/App";
import { loadData } from "./anime/lib/data";
import { installLinks, legacyRedirect, navigate } from "./shell/route";
import "./anime/styles.css";

// Anime Scout's old addresses (…/#/liked) open the same page at its new address (/anime/liked)
const moved = legacyRedirect(location.pathname, location.hash, location.search);
if (moved) navigate(moved, true);
installLinks(); // links inside the site change the page without reloading it

loadData(); // starts downloading the show data while the page draws

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

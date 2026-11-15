import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./anime/App";
import { loadData } from "./anime/lib/data";
import "./anime/styles.css";

loadData(); // starts downloading the show data while the page draws

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { dataUpdater } from "./update-plugin.ts";

export default defineConfig({
  // dataUpdater: Games' "Update now" button runs game-scout's update_steam.py through the dev server (update-plugin.ts)
  plugins: [react(), dataUpdater()],
  base: "/", // absolute links: pages live at nested addresses like /anime/liked
  // 5185 = the combined site (5173 Satisfactory planner, 5180 Steam Scout, 5181 Game Scout, 5182 Anime Scout, 5183 Nomikai Scout, 5184 Standup Notes)
  server: {
    port: 5185,
    strictPort: true,
    // While building, the Worker runs separately (`npm run dev` in worker/, port 8789); online they share one address
    proxy: { "/api": "http://localhost:8789" },
  },
  preview: { port: 5185, strictPort: true },
});

# Browser checks for the site (Playwright + Edge). Start the site first: cd web && npm run dev
#   python tests/browser/site_check.py <folder for screenshots>
#   python tests/browser/import_check.py <folder for screenshots and test files>
# Not run by pytest (no test_ in the name): they need the dev server.
#   python tests/browser/shell_check.py <folder for screenshots>   (service bar, Soon pages, addresses, phone)
#   python tests/browser/games_check.py <folder>    (Games: rating, platforms, Steam sales, phone)
#   python tests/browser/carry_check.py <folder>    (one-time Game Scout ratings copy, on made-up browser profiles)
#   python tests/browser/update_check.py <folder>   (Update now: a REAL Steam update, ~10 min; dev only)
# All checks open http://localhost:5185 (Games under /games/, Anime under /anime/). To check the live site instead:
#   set SITE=https://anime-scout.nomikai-scout-worker.workers.dev  (PowerShell: $env:SITE = "...")

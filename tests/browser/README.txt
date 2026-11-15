# Browser checks for the site (Playwright + Edge). Start the site first: cd web && npm run dev
#   python tests/browser/site_check.py <folder for screenshots>
#   python tests/browser/import_check.py <folder for screenshots and test files>
# Not run by pytest (no test_ in the name): they need the dev server.
#   python tests/browser/shell_check.py <folder for screenshots>   (service bar, Soon pages, addresses, phone)
# All checks open http://localhost:5185 (Anime under /anime/).

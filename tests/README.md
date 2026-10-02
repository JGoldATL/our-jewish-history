# Globe tests

Headless-browser checks for the globe (Playwright + Chromium). Run from the repo root:

    python3 -m http.server 8778 &          # serve the site
    NODE_PATH=$(npm root -g) node tests/reg.js     # regression contract
    NODE_PATH=$(npm root -g) node tests/lay.js     # phone / tablet / desktop layout
    NODE_PATH=$(npm root -g) node tests/sym.js     # symbols, revolt timing, key, sources
    NODE_PATH=$(npm root -g) node tests/pause.js   # Play / Pause on touch devices

Set SITE=... to test another address. Screenshots go to tests/out/reg/ (not committed).

What a passing run looks like (Oct 2, 2026, commit 19e63bc):
- reg.js: validate "0 issues"; sweep 1501 years, 0 mismatches; endpoints [-1300, 200];
  36 cards, kinds only Event / Community / Movement, bad []; no page errors
  (Google Fonts may fail to load in a sandbox; that is the network, not the site);
  iPhone / iPad portrait / iPad landscape: no errors, no sideways scroll.
- lay.js: iPhone and iPad portrait: pageScrolls false, titleVisible true; no errors.
- sym.js: symbols 0 at 69 CE, 1 at 70-114 CE, 4 from 115 CE; Hidabroot source listed.
- pause.js: every device ends with "▶ Play", stopped: true.

Always also look at the screenshots: the checks cannot judge appearance.

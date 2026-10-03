# Globe tests

Headless-browser checks for the globe (Playwright + Chromium). Run from the repo root:

    python3 -m http.server 8778 &          # serve the site
    NODE_PATH=$(npm root -g) node tests/reg.js     # regression contract
    NODE_PATH=$(npm root -g) node tests/lay.js     # phone / tablet / desktop layout
    NODE_PATH=$(npm root -g) node tests/sym.js     # symbols, revolt timing, key, sources
    NODE_PATH=$(npm root -g) node tests/pause.js   # Play / Pause on touch devices, icon shapes
    NODE_PATH=$(npm root -g) node tests/follow.js  # Previous / Next turn the globe to the card's place

    python3 tests/load.py                          # Sheet loader (tools/sheet-to-history.py); needs: pip install openpyxl

load.py builds a tiny workbook with planted internal text and checks: only public fields reach history.json, drafts load in preview and
are dropped by --public, a re-run of the same export changes nothing, an edit touches only its own record, bad records are rejected with a
reason (never silently fixed). It does not need the real Sheet. Loading the real Sheet: see the header of tools/sheet-to-history.py.

Set SITE=... to test another address. Screenshots go to tests/out/reg/ (not committed).

What a passing run looks like (Oct 2, 2026, commit 19e63bc):
- reg.js: validate "0 issues"; sweep 1501 years, 0 mismatches; endpoints [-1300, 200];
  30 cards (one per event: the three Assyrian routes are one card, and a destruction card replaces the community card about the same event), kinds only Event / Community / Movement, bad []; no page errors
  (Google Fonts may fail to load in a sandbox; that is the network, not the site);
  iPhone / iPad portrait / iPad landscape: no errors, no sideways scroll.
- lay.js: iPhone and iPad portrait: pageScrolls false, titleVisible true; no errors.
- sym.js: symbols 0 at 69 CE, 1 at 70-114 CE, 4 from 115 CE; Hidabroot source listed.
- pause.js: every device ends labelled Play, stopped: true, and the Play and Pause icons are drawn shapes of the same colour and height (no text characters).
- follow.js: Next visits all 30 cards once in order and Previous walks back; every card's place is on the front of the globe and on screen after Next, the user's zoom is kept unless the place cannot fit, Previous works, and touching the globe cancels a turn.

Always also look at the screenshots: the checks cannot judge appearance.

Map building (not a test): tools/build-map.py rebuilds images/tex-region.jpg, images/tex-world.jpg and the coast in data/geo.json
from Natural Earth land and lakes; the baked relief it works from is in images/src/. See the header of that file for the commands.
A sharper relief (Pass B) only has to replace images/src/relief-region.jpg and relief-world.jpg.

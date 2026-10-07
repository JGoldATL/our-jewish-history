# Globe tests

Headless-browser checks for the globe (Playwright + Chromium). Run from the repo root:

    python3 -m http.server 8778 &          # serve the site
    NODE_PATH=$(npm root -g) node tests/reg.js     # regression contract
    NODE_PATH=$(npm root -g) node tests/lay.js     # phone / tablet / desktop layout
    NODE_PATH=$(npm root -g) node tests/sym.js     # symbols, revolt timing, key, sources
    NODE_PATH=$(npm root -g) node tests/pause.js   # Play / Pause on touch devices, icon shapes
    NODE_PATH=$(npm root -g) node tests/follow.js  # Previous / Next turn the globe to the card's place
    NODE_PATH=$(npm root -g) node tests/links.js   # clicking a map object opens its Sheet card (data.cardLinks)

    python3 tests/load.py                          # Sheet loader (tools/sheet-to-history.py); needs: pip install openpyxl

load.py builds a tiny workbook with planted internal text and checks: only public fields reach history.json, drafts load in preview and
are dropped by --public, a re-run of the same export changes nothing, an edit touches only its own record, bad records are rejected with a
reason (never silently fixed). It does not need the real Sheet. Loading the real Sheet: see the header of tools/sheet-to-history.py.

Set SITE=... to test another address. Screenshots go to tests/out/reg/ (not committed).

What a passing run looks like (Oct 2, 2026, commit 19e63bc):
- reg.js: validate "0 issues"; sweep 2201 years, 0 mismatches; endpoints [-2000, 200];
  33 cards (the Sheet's cards, from data/history.json "sheet"; add ?engine=1 to see the old 30-card engine list), kinds Event / Community / Movement / Archaeology, bad []; no page errors
  (Google Fonts may fail to load in a sandbox; that is the network, not the site);
  iPhone / iPad portrait / iPad landscape: no errors, no sideways scroll.
- lay.js: iPhone and iPad portrait: pageScrolls false, titleVisible true; no errors.
- sym.js: symbols 0 at 69 CE, 1 at 70-114 CE, 4 from 115 CE; Hidabroot source listed.
- pause.js: every device ends labelled Play, stopped: true, and the Play and Pause icons are drawn shapes of the same colour and height (no text characters).
- follow.js: Next visits all 33 cards once in order and Previous walks back; every card's place is on the front of the globe and on screen after Next, the user's zoom is kept unless the place cannot fit, Previous works, and touching the globe cancels a turn.

Always also look at the screenshots: the checks cannot judge appearance.

Map building (not a test): tools/build-map.py rebuilds images/tex-region.jpg, images/tex-world.jpg and the coast in data/geo.json
from Natural Earth land and lakes; the baked relief it works from is in images/src/. See the header of that file for the commands.
A sharper relief (Pass B) only has to replace images/src/relief-region.jpg and relief-world.jpg.


arrows.js: Sheet arrows. Every Movement with both ends ready is drawn (none twice, none that an engine arrow already draws); the New Amsterdam branch rule holds; the 587 BCE arrow appears on the globe.

Pass 2 (Eras 4 to 7, Oct 6, 2026):
- load.py also covers the Eras, Camera Stops and Era Assignment tabs: the zoom rule (farthest frame Place x 1.15, floored by Role 12 or 24, clamped 10..45), unfit frames warn and clamp, bad rows are rejected with a reason, missing tabs are tolerated, a damaged Camera Stops tab stops the load. 57 checks, all pass.
- reg.js: the sweep runs to DATA.timeline.end (1897) and is camera-independent (it turns the globe to a missing arrow before counting a mismatch). It reports yearsWithArrowOffCamera, which is informational: an arrow hidden only because the camera is elsewhere.
- follow.js: the card walk covers every card (164 of 164 in order, then back).

Quiz page (Oct 6, 2026):
- quiz.js test: `NODE_PATH=$(npm root -g) node tests/quiz.js` (server on :8778). d3 and topojson are served from local copies (VEND, default /tmp/claude-0/vend/node_modules; `npm i d3@7.9.0 topojson-client@3` there) because the sandbox cannot reach cdnjs. Covers: Approved-only rule (production, ?drafts=1, preview, public), "not ready" message, one question per era with three different Styles in chronological order, multiple-choice lock/green/red, put-in-order with "You had #N", verdict wording, Dive deeper reveal, button text, end screen headline/score/timeline/gap lines/survey/buttons, Play 3 more, era pools, reduced motion, no horizontal scroll at 390 and 320 px, 44 px tap targets.
- load.py also covers the Questions tab (valid rows, each bad row rejected with a reason, Notes never leaks, public keeps Approved only).
- follow.js prints "cards not in view" in follow mode on the committed data too (informational, unchanged by the quiz); the walk itself passes.

Common Era rule (Oct 6, 2026):
- ce.js: CE years are written as the bare year (1654, not 1654 CE) everywhere on the globe; BCE stays; "CE" is kept only inside a string that also says BCE. The rule lives in engine.js (plainCE, plainCEDeep, yearLabel) and runs once on load; the quiz applies the same rule and keeps CE when its timeline crosses BCE. The loader prints an informational count of Sheet text that still says "CE" (never a reject).
- follow.js can report one card "not in view" when it runs at the same time as reg.js (CPU load); rerun it alone before treating it as real.

Quiz link (Oct 6, 2026): quizlink.js checks the "Take a Quiz" pill in the globe header: label and href, tap size (44 px desktop and iPad, 38 px phones), no overlap with the other controls, no horizontal scroll at 1440, 820, 390 and 320 px wide, and that a click opens the quiz. On phones the pill wraps to its own row, which moves the card title about 46 px lower (the iPhone SE title below the fold is the old baseline).

## Header regroup (tests/header.js)
Run: `NODE_PATH=$(npm root -g) node tests/header.js` (server on 8778). Checks at 10 widths from 1440 to 360 px that Play lives in the story nav (between Previous and Next), the header holds Take a Quiz, Map key, the toggle and Reset, desktop (over 960 px) is one row, narrower is title + Quiz on row 1 and controls on row 2, and nothing is off screen. At 360 px or less the controls may wrap to a third row (not checked). At 900 px or less the story nav sticks to the bottom of the panel.

Quiz answer logging (v0.4.0): NODE_PATH=$(npm root -g) node tests/log.js   # fake logger address; checks what is sent, when, and that a failing logger never blocks the quiz

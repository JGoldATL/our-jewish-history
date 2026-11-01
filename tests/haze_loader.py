#!/usr/bin/env python3
"""tools/sheet-to-haze.py: an empty OPENING card (the bare globe) is allowed and shows no haze; an empty card in the middle is still refused.
Run from the repo root: python3 tests/haze_loader.py"""
import csv, json, os, subprocess, sys, tempfile
CARD = ["Snapshot year", "Snapshot label", "Card title", "Period", "Summary", "Not-by-conquest note (optional)", "Jewish communities line",
        "Source 1", "Source 2", "Source 3", "Basis (internal, not shown)", "Status", "Spread line", "Spread source 1", "Spread source 2"]
ANCH = ["Record ID", "Anchor ID", "Snapshot year", "Anchor name", "Latitude", "Longitude", "Radius km", "Intensity", "Control type", "Date certainty", "Source record IDs", "Note", "Status"]
def card(y, label):
    return {"Snapshot year": y, "Snapshot label": label, "Card title": label + " title", "Period": "Test period",
            "Summary": "A test summary that is long enough to pass the fifty-two character floor.", "Jewish communities line": "A test Jewish line.",
            "Source 1": "Test source | https://example.org/s", "Status": "DRAFT"}
def anchor(i, y):
    return {"Record ID": "R%d" % i, "Anchor ID": "TST", "Snapshot year": y, "Anchor name": "Test place", "Latitude": 30, "Longitude": 40,
            "Radius km": 500, "Intensity": 4, "Control type": "Direct rule", "Date certainty": "Exact", "Status": "DRAFT"}
def run(cards, anchors):
    d = tempfile.mkdtemp(); cp, ap, op = [os.path.join(d, n) for n in ("cards.csv", "anchors.csv", "out.json")]
    for p, cols, rows in ((cp, CARD, cards), (ap, ANCH, anchors)):
        with open(p, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, cols); w.writeheader(); [w.writerow(r) for r in rows]
    r = subprocess.run([sys.executable, "tools/sheet-to-haze.py", "--cards", cp, "--anchors", ap, "--out", op, "--drafts"], capture_output=True, text=True)
    return r, (json.load(open(op)) if os.path.exists(op) else None)
bad = 0
def ck(c, m, x=None):
    global bad; print(("PASS " if c else "FAIL ") + m + ("" if c or x is None else " " + str(x)));  bad += 0 if c else 1
r, out = run([card(600, "600: start"), card(650, "650: wave"), card(2020, "2020: today")], [anchor(1, 650)])
ck(r.returncode == 0 and out is not None, "opening card with no anchors loads", r.stdout[-300:])
if out:
    ck([s["hold"] for s in out["snapshots"]] == [False, False, True], "only the closing card is a hold card", [s["hold"] for s in out["snapshots"]])
    ck(out["anchors"][0]["s"][0][1] == 0 and out["anchors"][0]["s"][1][1] > 0, "the place is off in the opening wave and on in 650", out["anchors"][0]["s"])
r, out = run([card(600, "600: start"), card(650, "650: wave"), card(700, "700: empty"), card(2020, "2020: today")], [anchor(1, 650)])
ck(r.returncode != 0 and "700" in r.stdout and out is None, "an empty card in the middle is still refused", r.stdout[-200:])
print("ALL PASS" if not bad else "%d FAILED" % bad); sys.exit(1 if bad else 0)

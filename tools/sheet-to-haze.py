#!/usr/bin/env python3
"""F-021 "Islamic Conquest": turn Dataset's two haze tabs into data/haze.json.

Inputs (either form):
  CSV files:       --anchors F-021_Haze_Anchors_TAB_v1.csv --cards F-021_Haze_Wave_Cards_TAB_v1.csv
  Sheet export:    an .xlsx, with --anchors-tab and --cards-tab naming the two tabs (the names are Jeffrey's to choose)

Rules, the same stance as the other loaders: LOCKED rows only (--drafts includes DRAFT rows and marks the file as a draft, for
Jeffrey's review only, never to be committed as data/haze.json). Problems are REPORTED, never fixed. Nothing is written when there is a problem
unless --force is given.

What the page may never print (Jeffrey and Dataset, 2026-10-31): Control type, Date certainty, the word "disputed". Both stay in the
file's source rows but are not copied into the output. The Basis column on the cards is internal and is dropped.
"""
import argparse, csv, json, re, sys, hashlib, datetime, collections

CONTROL = {"Direct rule", "Vassal or tributary", "Raid only", "Shared"}
STATUS = {"LOCKED", "DRAFT"}
A_COLS = ["Record ID", "Anchor ID", "Snapshot year", "Anchor name", "Latitude", "Longitude", "Radius km", "Intensity",
          "Control type", "Date certainty", "Source record IDs", "Note", "Status"]
C_COLS = ["Snapshot year", "Snapshot label", "Card title", "Period", "Summary", "Jewish communities line",
          "Source 1", "Source 2", "Source 3", "Status"]
NBC = "Not-by-conquest note"


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def read_xlsx(path, tab):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if tab not in wb.sheetnames:
        sys.exit("Tab not found in the workbook: %r. Tabs: %s" % (tab, wb.sheetnames))
    rows = list(wb[tab].iter_rows(values_only=True))
    head = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [{head[i]: ("" if v is None else str(v).strip()) for i, v in enumerate(r) if i < len(head)} for r in rows[1:] if any(v not in (None, "") for v in r)]


def g(row, key):
    if key in row:
        return (row[key] or "").strip()
    for k in row:                      # tolerate "(optional)" and similar suffixes on a header
        if k and k.strip().startswith(key):
            return (row[k] or "").strip()
    return ""


def whole(s):
    try:
        f = float(s)
        return int(f) if f == int(f) else None
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?", help="a .xlsx export of the Master Sheet (if not using CSV files)")
    ap.add_argument("--anchors"), ap.add_argument("--cards")
    ap.add_argument("--anchors-tab", default="Haze Anchors"), ap.add_argument("--cards-tab", default="Haze Wave Cards")
    ap.add_argument("--out", default="data/haze.json")
    ap.add_argument("--drafts", action="store_true", help="include DRAFT rows (review copies only)")
    ap.add_argument("--dry-run", action="store_true"), ap.add_argument("--force", action="store_true")
    ap.add_argument("--sheet-name", default=""), ap.add_argument("--sheet-modified", default="")
    a = ap.parse_args()

    if a.anchors and a.cards:
        arows, crows = read_csv(a.anchors), read_csv(a.cards)
        src_files = [a.anchors, a.cards]
    elif a.input:
        arows, crows = read_xlsx(a.input, a.anchors_tab), read_xlsx(a.input, a.cards_tab)
        src_files = [a.input]
    else:
        sys.exit("Give --anchors and --cards (CSV) or an .xlsx export.")

    problems = []
    P = problems.append
    for need, rows, name in ((A_COLS, arows, "anchors"), (C_COLS, crows, "cards")):
        have = set(rows[0].keys()) if rows else set()
        missing = [c for c in need if c not in have]
        if missing:
            sys.exit("Missing %s columns: %s" % (name, missing))
    if not any(k.strip().startswith(NBC) for k in crows[0]):
        sys.exit("Missing cards column: %s" % NBC)

    want = {"LOCKED", "DRAFT"} if a.drafts else {"LOCKED"}
    skipped = collections.Counter()

    # ---------- cards ----------
    cards = []
    seen_year = set()
    for r in crows:
        st = g(r, "Status").upper()
        if st not in STATUS:
            P("card %s: Status %r is not LOCKED or DRAFT" % (g(r, "Snapshot year"), g(r, "Status")))
        if st not in want:
            skipped["cards:" + st] += 1
            continue
        y = whole(g(r, "Snapshot year"))
        if y is None:
            P("card: Snapshot year %r is not a whole number" % g(r, "Snapshot year")); continue
        if y in seen_year:
            P("card %d: duplicate Snapshot year" % y)
        seen_year.add(y)
        label, title, summ = g(r, "Snapshot label"), g(r, "Card title"), g(r, "Summary")
        if not label or len(label) > 28: P("card %d: Snapshot label is %d characters (maximum 28)" % (y, len(label)))
        if not title or len(title) > 60: P("card %d: Card title is %d characters (maximum 60)" % (y, len(title)))
        if not 52 <= len(summ) <= 140: P("card %d: Summary is %d characters (52 to 140)" % (y, len(summ)))
        note, jew, per = g(r, NBC), g(r, "Jewish communities line"), g(r, "Period")
        if not jew: P("card %d: Jewish communities line is empty" % y)
        if not per: P("card %d: Period is empty" % y)
        srcs = []
        for k in ("Source 1", "Source 2", "Source 3"):
            s = g(r, k)
            if not s: continue
            m = re.match(r"^(.+?)\s*\|\s*(https?://\S+)$", s)
            if not m: P('card %d: %s is not "Name | URL": %r' % (y, k, s[:60])); continue
            srcs.append({"name": m.group(1).strip(), "url": m.group(2).strip()})
        if not srcs: P("card %d: no source" % y)
        sp_text = g(r, "Spread line")
        sp_srcs = []
        for k in ("Spread source 1", "Spread source 2"):
            s = g(r, k)
            if not s: continue
            m = re.match(r"^(.+?)\s*\|\s*(https?://\S+)$", s)
            if not m: P('card %d: %s is not "Name | URL": %r' % (y, k, s[:60])); continue
            sp_srcs.append({"name": m.group(1).strip(), "url": m.group(2).strip()})
        if sp_text and not sp_srcs: P("card %d: Spread line has no source" % y)
        if sp_srcs and not sp_text: P("card %d: Spread source given without a Spread line" % y)
        public = " ".join([label, title, per, summ, note, jew, sp_text] + [s["name"] for s in srcs + sp_srcs])
        if re.search(r"\b\d{1,4}\s*CE\b", public) and "BCE" not in public: P('card %d: "CE" after a year' % y)
        if re.search(r"disputed", public, re.I): P('card %d: the word "disputed" must not appear' % y)
        if re.search(r"palestin", public, re.I): P('card %d: "Palestine/Palestinian" must not appear (only Syria Palaestina)' % y)
        card = {"year": y, "label": label, "title": title, "period": per, "summary": summ, "note": note,
                "jewish": jew, "sources": srcs}
        if sp_text: card["spread"] = {"text": sp_text, "sources": sp_srcs}   # shown only when not blank (900, 1700, 1900 and the closing card have none)
        cards.append(card)
    cards.sort(key=lambda c: c["year"])

    # ---------- anchors ----------
    rid_seen, key_seen, info = set(), set(), {}
    by_year = collections.defaultdict(dict)
    order = []
    for r in arows:
        st = g(r, "Status").upper()
        if st not in STATUS:
            P("anchor %s: Status %r is not LOCKED or DRAFT" % (g(r, "Record ID"), g(r, "Status")))
        if st not in want:
            skipped["anchors:" + st] += 1
            continue
        rid, aid, name = g(r, "Record ID"), g(r, "Anchor ID"), g(r, "Anchor name")
        y = whole(g(r, "Snapshot year"))
        if rid in rid_seen: P("anchor row %s: duplicate Record ID" % rid)
        rid_seen.add(rid)
        if y is None or not aid: P("anchor row %s: bad Snapshot year or empty Anchor ID" % rid); continue
        if (aid, y) in key_seen: P("anchor %s: two rows for wave %d" % (aid, y))
        key_seen.add((aid, y))
        try: lat, lon = float(g(r, "Latitude")), float(g(r, "Longitude"))
        except ValueError: P("anchor %s %d: latitude or longitude is not a number" % (aid, y)); continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180): P("anchor %s %d: latitude/longitude out of range" % (aid, y))
        km, it = whole(g(r, "Radius km")), whole(g(r, "Intensity"))
        if km is None or not 150 <= km <= 1500: P("anchor %s %d: Radius km %r is not a whole number from 150 to 1500" % (aid, y, g(r, "Radius km")))
        if it is None or not 1 <= it <= 5: P("anchor %s %d: Intensity %r is not a whole number from 1 to 5" % (aid, y, g(r, "Intensity")))
        if g(r, "Control type") not in CONTROL: P("anchor %s %d: Control type %r is not one of %s" % (aid, y, g(r, "Control type"), sorted(CONTROL)))
        if not name: P("anchor %s %d: Anchor name is empty" % (aid, y))
        if re.search(r"palestin", name, re.I): P("anchor %s: name must not say Palestine" % aid)
        prev = info.get(aid)
        if prev and (prev[0], prev[1], prev[2]) != (name, lat, lon):
            P("anchor %s: name or position differs between waves (%s vs %s)" % (aid, prev[:3], (name, lat, lon)))
        info.setdefault(aid, (name, lat, lon))
        if aid not in order: order.append(aid)
        by_year[y][aid] = [km or 0, it or 0]

    # ---------- cross checks ----------
    card_years = [c["year"] for c in cards]
    if not cards: P("no cards loaded (every card row is %s)" % "/".join(sorted(set(STATUS) - want)) if False else "no cards loaded: nothing is %s yet" % "/".join(sorted(want)))
    for y in sorted(by_year):
        if y not in card_years: P("wave %d has anchors but no card (or the card is not %s)" % (y, "/".join(sorted(want))))
    empty = [c["year"] for c in cards if c["year"] not in by_year]
    for y in empty:
        if card_years and y != card_years[-1]: P("card %d has no anchors (allowed only for the closing card)" % y)
    if card_years != sorted(set(card_years)): P("card years are not in order")

    snaps = []
    for i, c in enumerate(cards):
        s = dict(c); s["hold"] = c["year"] not in by_year   # the closing card keeps the last wave's haze (it does not fade it out)
        snaps.append(s)
    anchors = []
    for aid in order:
        name, lat, lon = info[aid]
        s, last = [], [0, 0]
        for c in cards:
            if c["year"] in by_year:
                last = by_year[c["year"]].get(aid, [0, 0])
            elif c["year"] not in by_year:
                pass   # hold: repeat the previous wave's entry (last)
            s.append(list(last))
        anchors.append({"id": aid, "name": name, "lat": round(lat, 3), "lon": round(lon, 3), "s": s})

    sha = hashlib.sha256(b"".join(open(p, "rb").read() for p in src_files)).hexdigest()
    ver = re.findall(r"v\d+(?:\.\d+)+", a.sheet_name)
    out = {"schema": "haze-2", "mock": False, "draft": bool(a.drafts),
           "source": (a.sheet_name or "CSV files from Dataset") + (" (DRAFT rows included, review copy)" if a.drafts else ""),
           "sheetModified": a.sheet_modified, "exportSha256": sha, "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "snapshots": snaps, "anchors": anchors}

    print("Anchor rows read: %d | cards read: %d" % (len(arows), len(crows)))
    print("Written: %d cards, %d places over %d waves (%s)" % (len(snaps), len(anchors), len([c for c in cards if c['year'] in by_year]), "DRAFT rows included" if a.drafts else "LOCKED only"))
    if skipped: print("Skipped (not %s): %s" % ("/".join(sorted(want)), dict(skipped)))
    per_wave = collections.Counter({y: len(v) for y, v in by_year.items()})
    print("Anchors per wave:", dict(sorted(per_wave.items())))
    print("Problems: %d" % len(problems))
    for p in problems[:60]: print("  -", p)
    if len(problems) > 60: print("  ... and %d more" % (len(problems) - 60))
    if a.dry_run or (problems and not a.force):
        print("Nothing written." if problems and not a.dry_run else "Dry run: nothing written.")
        return 1 if problems else 0
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("Wrote", a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())

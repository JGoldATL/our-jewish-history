#!/usr/bin/env python3
"""Archaeology loader (F-113, v2.0.0): reads the Archaeology tab of the Master Sheet export and writes data/archaeology.json.

    python3 tools/sheet-to-archaeology.py EXPORT.xlsx [--out data/archaeology.json] [--dry-run] [--report PATH]
                                          [--sheet-name NAME] [--sheet-modified ISO] [--history data/history.json]

The tab is read by exact header names, never by column position. The Sheet spells the tab "Archeaology"; "Archaeology" is accepted too.
Rules (Dataset handoff 10/21, Strategy pin simplification 10/21):
  * Record status LOCKED goes public. LEANING and DRAFT are written with their status; the page shows them only with ?drafts=1.
    Anything else (blank, other words) is not written at all.
  * Text is copied verbatim. Nothing is edited, shortened or fixed. A field over its length limit is reported, never trimmed.
  * Map symbol is one of Site, Writing, Object. The older seven values are mapped here so the loader works on either Sheet:
    Structure, Burial, Site -> Site; Inscription, Scroll or text -> Writing; Coin, Artifact -> Object. Anything else is rejected with a reason.
  * Linked event IDs are kept only when the Events page has an approved card for them (data/history.json); others are listed as warnings.
  * NEVER written: Internal notes, Where it is now, Coordinate precision, Lost and found, Year lost, Year rediscovered.
  * Skipping a Site that has a find linked to it is done by the page (from Linked site ID), not here. Every record is written.
Needs: python3, openpyxl. Never commit the export.
"""
import argparse, datetime, hashlib, json, re, sys
from pathlib import Path

PUBLIC = {'LOCKED', 'LEANING', 'DRAFT'}
SYMBOLS = {'Site': 'Site', 'Structure': 'Site', 'Burial': 'Site', 'Writing': 'Writing', 'Inscription': 'Writing',
           'Scroll or text': 'Writing', 'Object': 'Object', 'Coin': 'Object', 'Artifact': 'Object'}
TABS = ('Archaeology', 'Archeaology')
REQUIRED = ['ID', 'Record type', 'Name', 'Linked site ID', 'Discovery year', 'Year note', 'Discovered by or excavation', 'Period label',
            'Period start year', 'Period end year', 'Headline era', 'Place ID', 'Latitude', 'Longitude', 'Coordinate precision',
            'Where to see it', 'Open to public', 'Map symbol', 'Importance', 'Subhead', 'Brief story', 'Deep dive', 'What it shows',
            'Limits', 'Linked Event IDs', 'Source 1', 'Source 1 URL', 'Source 2', 'Source 2 URL', 'Record status']
LIMITS = {'Name': 60, 'Subhead': 40, 'Brief story': 220, 'Deep dive': 600, 'What it shows': 120}


def text(v):
    return None if v is None else str(v).strip() or None


def num(v):
    if v is None or str(v).strip() == '':
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return int(f) if f == int(f) else f


def table(wb, names):
    name = next((n for n in names if n in wb.sheetnames), None)
    if not name:
        sys.exit('Missing tab: ' + ' / '.join(names))
    rows = list(wb[name].iter_rows(values_only=True))
    hdr = [str(h).strip() if h is not None else '' for h in rows[0]]
    out = []
    for i, r in enumerate(rows[1:], start=2):
        if not r or all(v is None or str(v).strip() == '' for v in r):
            continue
        d = {hdr[j]: v for j, v in enumerate(r) if hdr[j]}
        d['_row'] = i
        out.append(d)
    return name, hdr, out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('xlsx')
    ap.add_argument('--out', default='data/archaeology.json')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report')
    ap.add_argument('--sheet-name', default='Jewish_Continuity_Master_Dataset_v2.0.0')
    ap.add_argument('--sheet-modified')
    ap.add_argument('--history', default='data/history.json', help='used only to check that Events cards exist for Linked Event IDs')
    a = ap.parse_args(argv)
    try:
        import openpyxl
    except ImportError:
        sys.exit('pip install openpyxl')
    xlsx = Path(a.xlsx)
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    tab, hdr, rows = table(wb, TABS)
    missing = [h for h in REQUIRED if h not in hdr]
    if missing:
        sys.exit('The ' + tab + ' tab is missing columns: ' + ', '.join(missing))
    place_ids = set()
    if 'Places' in wb.sheetnames:
        place_ids = {text(r.get('Place ID')) for r in table(wb, ('Places',))[2]}
    cards = {}
    hp = Path(a.history)
    if hp.exists():
        cards = {c['id']: c.get('title') for c in json.loads(hp.read_text(encoding='utf-8'))['sheet']['cards'] if c.get('status') == 'approved'}
    warns, rejected, dropped = [], [], []

    ids = {text(r.get('ID')) for r in rows}
    type_of = {text(r.get('ID')): text(r.get('Record type')) for r in rows}
    recs = []
    seen = set()
    for r in rows:
        rid = text(r.get('ID'))
        st = (text(r.get('Record status')) or '').upper()
        if not rid:
            rejected.append((f"row {r['_row']}", 'no ID'))
            continue
        if rid in seen:
            rejected.append((rid, 'duplicate ID'))
            continue
        seen.add(rid)
        if st not in PUBLIC:
            dropped.append((rid, st or 'blank'))
            continue
        why = []
        typ = text(r.get('Record type'))
        if typ not in ('Site', 'Object'):
            why.append(f'Record type "{typ}" is not Site or Object')
        sym_raw = text(r.get('Map symbol'))
        sym = SYMBOLS.get(sym_raw)
        if not sym:
            why.append(f'Map symbol "{sym_raw}" is not Site, Writing or Object')
        elif typ == 'Site' and sym != 'Site':
            warns.append(f'{rid}: a Site record has Map symbol {sym_raw}; drawn with that symbol as written')
        elif typ == 'Object' and sym == 'Site':
            warns.append(f'{rid}: an Object record has Map symbol {sym_raw}; drawn with that symbol as written')
        lat, lon = num(r.get('Latitude')), num(r.get('Longitude'))
        if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            why.append('latitude or longitude missing or out of range')
        dy = num(r.get('Discovery year'))
        if dy is None or dy == 0:
            why.append('Discovery year missing')
        name = text(r.get('Name'))
        if not name:
            why.append('no Name')
        link = text(r.get('Linked site ID'))
        if typ == 'Object':
            if not link:
                why.append('Object has no Linked site ID')
            elif link not in ids:
                why.append(f'Linked site ID {link} is not in the tab')
            elif type_of.get(link) != 'Site':
                why.append(f'Linked site ID {link} is not a Site record')
        elif link:
            warns.append(f'{rid}: a Site record has a Linked site ID ({link}); ignored')
            link = None
        imp = num(r.get('Importance'))
        if imp not in (1, 2, 3):
            why.append(f'Importance "{r.get("Importance")}" is not 1, 2 or 3')
        if why:
            rejected.append((rid, '; '.join(why)))
            continue
        for col, lim in LIMITS.items():
            v = text(r.get(col))
            if v and len(v) > lim:
                warns.append(f'{rid}: {col} is {len(v)} characters (limit {lim}); shown as written')
        for col in ('Subhead', 'Brief story', 'What it shows', 'Limits', 'Deep dive'):
            if not text(r.get(col)):
                warns.append(f'{rid}: {col} is blank')
        pid = text(r.get('Place ID'))
        if place_ids and pid not in place_ids:
            warns.append(f'{rid}: Place ID {pid} is not in the Places tab')
        evs = []
        for x in [y.strip() for y in (text(r.get('Linked Event IDs')) or '').split(',') if y.strip()]:
            if not cards or x in cards:
                evs.append({'id': x, 'title': cards.get(x)} if cards else {'id': x})
            else:
                warns.append(f'{rid}: Linked Event {x} has no approved Events card on the site; no link shown')
        if not evs:
            warns.append(f'{rid}: no Events card to link to')
        srcs = []
        for n in (1, 2):
            nm, url = text(r.get(f'Source {n}')), text(r.get(f'Source {n} URL'))
            if nm:
                srcs.append({k: v for k, v in (('name', nm), ('url', url)) if v})
                if not url:
                    warns.append(f'{rid}: Source {n} has no URL (shown without a link)')
        if len(srcs) == 2 and all('wikipedia' in s['name'].lower() for s in srcs):
            warns.append(f'{rid}: both sources are Wikipedia')
        if len(srcs) < 2:
            warns.append(f'{rid}: only {len(srcs)} source')
        if st == 'LOCKED' and not (text(r.get('Deep dive')) and text(r.get('Limits'))):
            warns.append(f'{rid}: LOCKED but Deep dive or Limits is blank')
        e = {
            'id': rid, 'type': typ, 'name': name, 'linkedSite': link, 'year': int(dy), 'yearNote': text(r.get('Year note')),
            'foundBy': text(r.get('Discovered by or excavation')), 'periodLabel': text(r.get('Period label')),
            'periodStart': num(r.get('Period start year')), 'periodEnd': num(r.get('Period end year')), 'era': text(r.get('Headline era')),
            'placeId': pid, 'lat': lat, 'lon': lon, 'whereToSee': text(r.get('Where to see it')), 'open': text(r.get('Open to public')),
            'symbol': sym, 'importance': int(imp), 'subhead': text(r.get('Subhead')), 'story': text(r.get('Brief story')),
            'deepDive': text(r.get('Deep dive')), 'shows': text(r.get('What it shows')), 'limits': text(r.get('Limits')),
            'events': evs, 'sources': srcs, 'status': st,
        }
        if e['periodStart'] is None or e['periodEnd'] is None:
            warns.append(f'{rid}: Period start or end year missing; the item-period lens will skip it')
        recs.append({k: v for k, v in e.items() if v is not None and v != []})
    recs.sort(key=lambda e: e['id'])

    out = {'schema': 'archaeology-1', 'source': 'Google Sheet ' + a.sheet_name, 'sheetModified': a.sheet_modified,
           'exportSha256': hashlib.sha256(xlsx.read_bytes()).hexdigest()[:16],
           'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'records': recs}
    by_st, by_sym = {}, {}
    for e in recs:
        by_st[e['status']] = by_st.get(e['status'], 0) + 1
        by_sym[e['symbol']] = by_sym.get(e['symbol'], 0) + 1
    # what the page will draw: a Site with at least one find linked to it is skipped
    linked = {e['linkedSite'] for e in recs if e['type'] == 'Object' and e.get('linkedSite')}
    own = [e for e in recs if e['type'] == 'Site' and e['id'] not in linked]
    spots = {}
    for e in recs:
        if e['type'] == 'Object' or e['id'] not in linked:
            spots.setdefault((round(e['lat'], 3), round(e['lon'], 3)), []).append(e['id'] + ' ' + e['name'])
    shared = {k: v for k, v in spots.items() if len(v) > 1}
    print(f"Loaded {xlsx.name} tab {tab}: {len(rows)} rows")
    print(f"Written: {len(recs)} {by_st}; symbols {by_sym}; not written: {dropped}; rejected: {rejected}")
    print(f"Pins the page will draw: {len(recs) - len(linked)} ({sum(1 for e in recs if e['type']=='Object')} finds + {len(own)} sites with no find; {len(linked)} sites skipped because a find is linked)")
    print(f"Places where drawn pins share a spot (the page nudges them apart): {len(shared)}")
    for k, v in shared.items():
        print('  spot ' + str(k) + ': ' + ' | '.join(v))
    print(f'Warnings: {len(warns)}')
    for w in warns:
        print('  warn  ' + w)
    if a.report:
        Path(a.report).write_text(json.dumps({'warnings': warns, 'notWritten': dropped, 'rejected': rejected, 'sharedSpots': {f'{k[0]},{k[1]}': v for k, v in shared.items()}, 'statusCounts': by_st, 'symbolCounts': by_sym}, indent=1))
    if a.dry_run:
        print('Dry run: nothing written.')
        return
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print('Wrote ' + a.out)


if __name__ == '__main__':
    main()

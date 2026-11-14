#!/usr/bin/env python3
"""Loader v2 (rebuilt 13 Nov 2026, NOT committed): reads the NEW Master Sheet tables and feeds the OLD build logic.

Reads: Records v1, Routes, Record Links, World Pairs, Camera Stops v1, Stop Records v1, Eras v1, Community Eras, Places.
Still reads from the old tabs (the new tables do not hold them): Communities (POP and LOC rows, and the engine fields),
Context & Voyages, Evidence, Questions.

HOW: it builds an adapted workbook in a temporary file with the OLD tab names and columns, filled from the new tables, then runs
tools/sheet-to-history.py on it with the same options. The old build logic is untouched, so only the data source changes.

USAGE   python3 tools/sheet-to-history-v2.py EXPORT.xlsx [any option of sheet-to-history.py, e.g. --dry-run --out PATH --report PATH]
        --include-new-drafts   also load the four DRAFT Events EVT-0153 to 0156 (left out by default: the freeze question is open)
        --keep-adapted PATH    keep the adapted workbook for inspection
RULES (Jeffrey, 13 Nov): a movement belongs to its Event by top leg only (child legs are not listed on the Event); Routes wins where
the old Events tab disagreed; Meanwhile lines come from World Pairs 'Chosen Meanwhile line'; era runs from the start year.
"""
import importlib.util, re, sys, tempfile, collections
from pathlib import Path
import openpyxl

HERE = Path(__file__).resolve().parent
LINK = re.compile(r'\b(?:EVT|POP|CHG|DES|LOC|MOV|CTX|VOY|EVD)-\d+\b')


def load_old():
    spec = importlib.util.spec_from_file_location('old_loader', HERE / 'sheet-to-history.py')
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def rows(wb, name):
    ws = wb[name]; h = [c.value for c in ws[1]]
    return h, [dict(zip(h, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r and r[0] not in (None, '')]


def blank(v):
    return None if v == '' else v


def stop_label(s):
    s = str(s).strip()
    return s[1:] if s.upper().startswith('S') else s


def adapt(src, dst, include_new_drafts=False):
    wb = openpyxl.load_workbook(src, data_only=True)
    out = openpyxl.Workbook(); out.remove(out.active)
    notes = []

    def copy_tab(name):
        ws = wb[name]; o = out.create_sheet(name)
        for r in ws.iter_rows(values_only=True):
            if r and any(c is not None for c in r):
                o.append(list(r))
        return o

    # ---- tabs kept as they are (the new tables do not hold them)
    for t in ('Context & Voyages', 'Evidence', 'Questions', 'Places'):
        copy_tab(t)

    # ---- helper: overwrite named columns of a copied tab, keyed by the first column
    def overlay(name, new_by_id, colmap, extra_ids=()):
        ws = copy_tab(name)
        hdr = [c.value for c in ws[1]]; pos = {h: i for i, h in enumerate(hdr) if h}
        seen = set()
        for r in ws.iter_rows(min_row=2):
            rid = r[0].value
            if rid in new_by_id:
                seen.add(rid)
                for col, val in colmap(new_by_id[rid]).items():
                    r[pos[col]].value = val
        return ws, hdr, pos, seen

    h, rec = rows(wb, 'Records v1'); REC = {r['ID']: r for r in rec}
    h, legs = rows(wb, 'Routes'); LEG = {r['Leg ID']: r for r in legs}
    h, rl = rows(wb, 'Record Links')
    h, wp = rows(wb, 'World Pairs')
    h, cs = rows(wb, 'Camera Stops v1'); h, sr = rows(wb, 'Stop Records v1')
    h, ev1 = rows(wb, 'Eras v1'); h, ce = rows(wb, 'Community Eras')

    # ---- Events
    top = collections.defaultdict(list)
    for r in legs:
        if not r['Parent leg ID']:
            top[r['Record ID']].append(r['Leg ID'])
    evid = collections.defaultdict(list)
    for r in rl:
        if r['Link kind'] == 'evidence' and r['Source tab'] == 'Events':
            evid[r['Record ID']].append(r['Linked ID'])
    _, evd = rows(wb, 'Evidence')   # Record Links lacks the links for EVD-001 to 007, 010 and 011 (checked 13 Nov), so the Evidence tab's own link column is used too
    for r in evd:
        for e in LINK.findall(str(r['Linked event IDs'] or '')):
            if r['Evidence ID'] not in evid[e]:
                evid[e].append(r['Evidence ID'])
    mw = {r['Record ID']: r for r in wp if r['Pair kind'] == 'Meanwhile'}

    def ev_cols(r):
        i = r['ID']; m = mw.get(i)
        return {'Start year': r['Start year'], 'End year': blank(r['End year']), 'Date (display)': r['Display date'],
                'Place ID': r['Place ID'], 'Movement record IDs': '; '.join(top.get(i, [])) or None,
                'Evidence object IDs': '; '.join(evid.get(i, [])) or None,
                'Card type': blank(r['Card type']), 'Card date': blank(r['Card date']), 'Card title': blank(r['Card title']),
                'Card description': blank(r['Card description']),
                'Meanwhile (card line)': (m['Chosen Meanwhile line'] if m else None),
                'Meanwhile status': (m['Meanwhile status (Events tab)'] if m else None),
                'Map symbol': blank(r['Map symbol']), 'Card status': blank(r['Card status'])}
    ws, hdr, pos, seen = overlay('Events', {k: v for k, v in REC.items() if v['Legacy tab'] == 'Events'}, ev_cols)
    if include_new_drafts:
        for i in ('EVT-0153', 'EVT-0154', 'EVT-0155', 'EVT-0156'):
            if i in REC and i not in seen:
                row = [None] * len(hdr); row[0] = i
                for c, v in ev_cols(REC[i]).items(): row[pos[c]] = v
                ws.append(row)
    else:
        notes.append('left out: the four DRAFT Events EVT-0153 to 0156 (use --include-new-drafts)')

    # ---- Communities: CHG and DES from Records v1, POP and LOC stay as in the old tab
    comm_links = collections.defaultdict(list)
    for r in rl:
        if r['Source tab'] == 'Communities' and r['Source column'] == 'Linked records':
            comm_links[r['Record ID']].append(r['Linked ID'])

    def cm_cols(r):
        i = r['ID']; c = {'Start year': r['Start year'], 'End year': blank(r['End year']), 'Date (display)': r['Display date'],
                          'Place ID': r['Place ID'], 'Map symbol': blank(r['Map symbol']), 'Card type': blank(r['Card type']),
                          'Card date': blank(r['Card date']), 'Card title': blank(r['Card title']),
                          'Card description': blank(r['Card description']), 'Card status': blank(r['Card status'])}
        return c
    overlay('Communities', {k: v for k, v in REC.items() if v['Legacy tab'] == 'Communities'}, cm_cols)

    # ---- Movements from Routes; the old Linked records held POPs, other records, the branch children (on a top leg) and the parents (on a child)
    kids = collections.defaultdict(list)
    for r in legs:
        if r['Parent leg ID']:
            kids[r['Parent leg ID']].append(r['Leg ID'])
    oldmov = wb['Movements']; oh = [c.value for c in oldmov[1]]
    oldlinks = {r[0]: r[oh.index('Linked records')] for r in oldmov.iter_rows(min_row=2, values_only=True) if r[0]}

    def chain(i):
        out_, p, seen_ = [], LEG[i]['Parent leg ID'], set()
        while p and p not in seen_:
            out_.append(p); seen_.add(p); p = LEG[p]['Parent leg ID']
        return out_

    def mv_cols(r):
        i = r['Leg ID']
        pops = [x for x in LINK.findall(str(r['Linked POP IDs'] or ''))]
        others = [x for x in LINK.findall(str(oldlinks.get(i) or '')) if x[:3] not in ('POP', 'MOV')]   # CHG/DES links are not in Routes: kept from the old tab
        links_ = pops + others + chain(i)   # a child lists its parents; a parent does not list its children (the old build derives the branch lists)
        return {'Event ID': r['Record ID'], 'Title': r['Title'], 'Origin (historical)': blank(r['Origin (historical)']),
                'Destination (historical)': blank(r['Destination (historical)']), 'Date (display)': r['Display date'],
                'Start year': r['Start year'], 'End year': blank(r['End year']), 'Movement character': r['Movement character'],
                'Arrow treatment': r['Arrow treatment'], 'Linked records': '; '.join(dict.fromkeys(links_)) or None,
                'Origin place ID': blank(r['Origin place ID']), 'Destination place ID': blank(r['Destination place ID']),
                'Branch Subhead': blank(r['Branch subhead']), 'Branch Story': blank(r['Branch story']),
                'Branch Deep Dive': blank(r['Branch deep dive']), 'Branch Text Status': blank(r['Branch text status']),
                'Branch Group': blank(r['Branch group']), 'Branch Travel Mode': blank(r['Travel mode']),
                'Size band': blank(r['Size band']), 'Size band figure': blank(r['Size band figure']),
                'Size band basis (internal)': blank(r['Size band basis (internal)'])}
    overlay('Movements', LEG, mv_cols)

    # ---- Eras, Camera Stops, Era Assignment
    ws = out.create_sheet('Eras')
    ws.append(['Era', 'Era name (proposed)', 'Start year', 'Start (display)', 'Last year inside era', 'Summary line (one sentence, proposed)',
               'Opening camera centre (Place ID)', 'Frame must keep on screen (Place IDs)', 'Status', 'Headline era'])
    for r in ev1:
        ws.append([r['Era'], r['Era name'], r['Start year'], r['Display date'], r['End year'], r['Summary line'], blank(r['Centre place ID']),
                   blank(r['Frame place IDs']), r['Legacy status'], blank(r['Headline era'])])
    recs_of = collections.defaultdict(list)
    for r in sr:
        recs_of[stop_label(r['Stop'])].append(r['Record ID'])
    ws = out.create_sheet('Camera Stops')
    ws.append(['Stop', 'Era', 'Start year', 'Stop label (proposed)', 'Camera centre (Place ID)', 'Centre scale (Places Role)',
               'Frame must keep on screen (Place IDs)', 'Justifying Sheet records (IDs)', 'Status'])
    roles = {r[0]: r[3] for r in wb['Places'].iter_rows(min_row=2, values_only=True) if r[0]}
    for r in cs:
        s = stop_label(r['Stop'])
        ws.append([s, r['Era'], r['Start year'], r['Stop label'], r['Centre place ID'], roles.get(r['Centre place ID']),
                   blank(r['Frame place IDs']), '; '.join(dict.fromkeys(recs_of.get(s, []))) or None, r['Legacy status']])
    ws = out.create_sheet('Era Assignment')
    ws.append(['Record ID', 'Era (recommended boundaries)', 'Runs past era end?'])
    for r in rec:
        if r['Legacy tab'] in ('Events', 'Communities') and r['Era'] not in (None, ''):
            ws.append([r['ID'], 'Era %d' % int(r['Era']), None])
    for r in legs:
        if r['Era'] not in (None, ''):
            ws.append([r['Leg ID'], 'Era %d' % int(r['Era']), None])
    for r in ce:
        if r['Era'] not in (None, ''):
            ws.append([r['Record ID'], 'Era %d' % int(r['Era']), None])
    out.save(dst)
    return notes


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith('-'):
        sys.exit(__doc__)
    inc = '--include-new-drafts' in args
    keep = None
    rest = []
    it = iter(args)
    for a in it:
        if a == '--include-new-drafts':
            continue
        if a == '--keep-adapted':
            keep = next(it); continue
        rest.append(a)
    src = rest[0]
    tmp = keep or str(Path(tempfile.mkdtemp()) / 'adapted.xlsx')
    for n in adapt(src, tmp, inc):
        print('NOTE:', n)
    old = load_old()
    old.main([tmp] + rest[1:])


if __name__ == '__main__':
    main()

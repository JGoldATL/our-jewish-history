#!/usr/bin/env python3
"""Thank Jews For loader (F-103): reads the "Thank Jews For" tab of the Master Sheet and writes data/inventions.json.

    python3 tools/sheet-to-inventions.py INPUT [--out data/inventions.json] [--dry-run] [--report PATH]
                                         [--sheet-name NAME] [--sheet-modified ISO]

INPUT is either an .xlsx export of the Master Sheet (the tab "Thank Jews For" is read) or the tab saved as a .csv.
Columns are read by exact header name, never by position:
  Record ID, Status, Order, Category, Family, Field, Short label, Card summary, Why it matters, Year, Approximate,
  Geographic origin, Originator, Deep dive, Source   (Source is one "Name | URL")
Rules (Dataset handoff 2026-10-30, Jeffrey's decisions):
  * Only Status exactly LOCKED is written. Anything else (blank, DRAFT, LEANING) is skipped and reported.
  * Text is copied verbatim. Nothing is edited, shortened or fixed. Questions about wording go to Dataset.
  * Category is kept in the file but the page does not show it (Jeffrey 2026-10-30).
  * Problems are reported, never silently fixed: duplicate IDs, bad year, label over 32 characters, summary or deep dive
    outside the agreed ranges, a Source that is not "Name | URL", a Common Era year written with CE, an em dash.
Needs: python3 (openpyxl only for .xlsx). Never commit the export.
"""
import argparse, csv, datetime, hashlib, io, json, re, sys
from pathlib import Path

TAB = 'Thank Jews For'
COLS = ['Record ID', 'Status', 'Order', 'Category', 'Family', 'Field', 'Short label', 'Card summary', 'Why it matters',
        'Year', 'Approximate', 'Geographic origin', 'Originator', 'Deep dive', 'Source']
FAMILIES = ['Health and medicine', 'Science and discovery', 'Society and ideas', 'Computing and communication',
            'Everyday life and engineering', 'Arts and entertainment']


def text(v):
    return '' if v is None else str(v).strip()


def read_rows(path):
    p = Path(path)
    if p.suffix.lower() == '.csv':
        raw = p.read_bytes()
        rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline='')))
    else:
        from openpyxl import load_workbook
        wb = load_workbook(p, read_only=True, data_only=True)
        if TAB not in wb.sheetnames:
            sys.exit('Missing tab: ' + TAB)
        raw = p.read_bytes()
        rows = [list(r) for r in wb[TAB].iter_rows(values_only=True)]
    if not rows:
        sys.exit('The tab is empty')
    head = [text(h) for h in rows[0]]
    missing = [c for c in COLS if c not in head]
    if missing:
        sys.exit('Missing columns: ' + ', '.join(missing))
    out = []
    for r in rows[1:]:
        if not any(text(x) for x in r):
            continue
        out.append({h: text(r[i]) if i < len(r) else '' for i, h in enumerate(head)})
    return out, hashlib.sha256(raw).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('--out', default='data/inventions.json')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report')
    ap.add_argument('--sheet-name', default='Google Sheet Jewish_Continuity_Master_Dataset (tab Thank Jews For)')
    ap.add_argument('--sheet-modified', default='')
    a = ap.parse_args()
    rows, digest = read_rows(a.input)
    entries, problems, skipped, seen = [], [], [], set()
    for r in rows:
        rid = r['Record ID']
        if r['Status'] != 'LOCKED':
            skipped.append((rid, r['Status'] or '(blank)'))
            continue
        if not rid or rid in seen:
            problems.append(f'{rid or "(no id)"}: missing or duplicate Record ID')
            continue
        seen.add(rid)
        try:
            y=r['Year'].strip()
            year = int(y[:-2] if y.endswith('.0') else y)
        except ValueError:
            problems.append(f'{rid}: Year "{r["Year"]}" is not a whole number')
            continue
        src = r['Source']
        m = re.match(r'^(.*)\s\|\s(https?://\S+)$', src)
        if not m:
            problems.append(f'{rid}: Source is not "Name | URL"')
            name, url = src, ''
        else:
            name, url = m.group(1).strip(), m.group(2).strip()
        if r['Family'] not in FAMILIES:
            problems.append(f'{rid}: Family "{r["Family"]}" is not one of the 6 agreed families')
        lab = r['Short label']
        if len(lab) > 32:
            problems.append(f'{rid}: Short label is {len(lab)} characters (maximum 32)')
        if not 52 <= len(r['Card summary']) <= 140:
            problems.append(f'{rid}: Card summary is {len(r["Card summary"])} characters (agreed 52 to 140)')
        if not 330 <= len(r['Deep dive']) <= 510:
            problems.append(f'{rid}: Deep dive is {len(r["Deep dive"])} characters (agreed 330 to 510)')
        for col in ('Short label', 'Card summary', 'Deep dive', 'Why it matters'):
            v = r[col]
            if re.search(r'\bCE\b', v) and not re.search(r'\bBCE\b', v):
                problems.append(f'{rid}: {col} has "CE" (bare years only)')
            if '—' in v:
                problems.append(f'{rid}: {col} has an em dash')
        entries.append({
            'id': rid, 'status': 'LOCKED', 'order': int(r['Order']) if r['Order'].isdigit() else len(entries) + 1,
            'category': r['Category'], 'family': r['Family'], 'field': r['Field'],
            'shortLabel': lab, 'summary': r['Card summary'], 'why': r['Why it matters'],
            'year': year, 'approx': r['Approximate'].upper() == 'TRUE',
            'origin': r['Geographic origin'], 'originator': r['Originator'], 'deepDive': r['Deep dive'],
            'source': {'name': name, 'url': url},
        })
    labels = [e['shortLabel'].lower() for e in entries]
    for e in entries:
        if labels.count(e['shortLabel'].lower()) > 1:
            problems.append(f'{e["id"]}: Short label "{e["shortLabel"]}" is not unique')
    entries.sort(key=lambda e: (e['order'], e['id']))
    fam = {}
    for e in entries:
        fam[e['family']] = fam.get(e['family'], 0) + 1
    cat = {}
    for e in entries:
        cat[e['category']] = cat.get(e['category'], 0) + 1
    data = {'schema': 'inventions-1', 'source': a.sheet_name, 'sheetModified': a.sheet_modified, 'exportSha256': digest,
            'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'entries': entries}
    lines = [f'Rows read: {len(rows)}', f'Written (LOCKED): {len(entries)}', f'Skipped (not LOCKED): {len(skipped)} {skipped}',
             f'Families: {fam}', f'Categories (kept in the file, not shown): {cat}',
             f'Problems: {len(problems)}'] + ['  ' + p for p in problems]
    rep = '\n'.join(lines)
    print(rep, file=sys.stderr)
    if a.report:
        Path(a.report).write_text(rep + '\n', encoding='utf-8')
    if a.dry_run:
        return
    Path(a.out).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'Wrote {a.out}', file=sys.stderr)


if __name__ == '__main__':
    main()

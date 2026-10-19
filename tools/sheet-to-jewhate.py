#!/usr/bin/env python3
"""JewHate loader: reads the three JewHate tabs of the Master Sheet export and writes data/jewhate.json.

    python3 tools/sheet-to-jewhate.py EXPORT.xlsx [--out data/jewhate.json] [--dry-run] [--report PATH]
                                      [--sheet-name NAME] [--sheet-modified ISO]

Tabs (read by exact header names, never by column position): JewHate, JewHate Sources, JewHate Field Guide.
Rules (Dataset handoff 10/20, Strategy build spec 10/20):
  * Record status exactly LOCKED goes public. LEANING is written with its status and shows only with ?drafts=1.
    Anything else (blank, other words) is not written at all.
  * Text is copied verbatim. Nothing is edited, shortened or fixed. Questions about wording go to Dataset.
  * "Immediate factual correction" is split on its two labels, "The lie:" and "The record:".
  * Source references (JHS IDs, semicolon separated) are joined to the JewHate Sources tab. A blank URL stays blank
    (the page shows the source without a link). URL status and Notes are internal and never written.
  * Related JH IDs are kept when they point at a LOCKED or LEANING entry; the page links only to entries it is showing.
  * NEVER written: Knowledge category, Date certainty, Accuracy cautions, Claim-to-source map, Internal notes,
    Evidence status, Last reviewed, Related Event / Place / Movement / Question IDs.
  * Optional column "Short label": a short name for the big card title. Dataset owns it. Blank means the page falls back to Title.
Needs: python3, openpyxl. Never commit the export.
"""
import argparse, datetime, hashlib, json, re, sys
from pathlib import Path

PUBLIC = {'LOCKED', 'LEANING'}


def table(wb, name):
    if name not in wb.sheetnames:
        sys.exit('Missing tab: ' + name)
    rows = list(wb[name].iter_rows(values_only=True))
    if not rows:
        return []
    hdr = [str(h).strip() if h is not None else '' for h in rows[0]]
    out = []
    for r in rows[1:]:
        if not r or all(v is None or str(v).strip() == '' for v in r):
            continue
        out.append({hdr[i]: (None if v is None or str(v).strip() == '' else (v.strip() if isinstance(v, str) else v)) for i, v in enumerate(r) if hdr[i]})
    return out


def text(v):
    return None if v is None else str(v).strip() or None


def year_of(v):
    """Bare year, BCE kept, blank if unknown, never 0."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        n = int(v)
        return None if n == 0 else n
    s = str(v).strip()
    m = re.match(r'^(-?\d{1,4})\s*(BCE|BC)?$', s, re.I)
    if not m:
        return None
    n = int(m.group(1))
    if m.group(2):
        n = -abs(n)
    return None if n == 0 else n


def split_lie_record(s):
    m = re.match(r'^\s*The lie:\s*(.*?)\s*The record:\s*(.*)\s*$', s or '', re.S)
    return (m.group(1).strip(), m.group(2).strip()) if m else (None, None)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('xlsx')
    ap.add_argument('--out', default='data/jewhate.json')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report')
    ap.add_argument('--sheet-name', default='Jewish_Continuity_Master_Dataset_v0.5.1')
    ap.add_argument('--sheet-modified')
    a = ap.parse_args(argv)
    try:
        import openpyxl
    except ImportError:
        sys.exit('pip install openpyxl')
    xlsx = Path(a.xlsx)
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    jh, src = table(wb, 'JewHate'), table(wb, 'JewHate Sources')
    table(wb, 'JewHate Field Guide')   # must exist; it is the rulebook
    warns, dropped = [], []

    S = {}
    for r in src:
        sid = text(r.get('Source ID'))
        if sid:
            S[sid] = {'id': sid, 'publisher': text(r.get('Publisher')), 'title': text(r.get('Title')), 'url': text(r.get('URL')), 'type': text(r.get('Source type'))}

    status = {text(r.get('JH ID')): (text(r.get('Record status')) or '').upper() for r in jh}
    entries = []
    for r in jh:
        jid = text(r.get('JH ID'))
        st = (text(r.get('Record status')) or '').upper()
        if st not in PUBLIC:
            dropped.append((jid, st or 'blank'))
            continue
        lie, record = split_lie_record(text(r.get('Immediate factual correction')))
        if lie is None:
            warns.append(f'{jid}: Immediate factual correction does not have both "The lie:" and "The record:" labels')
        deep = text(r.get('Deep Dive narrative'))
        if st == 'LOCKED' and not deep:
            warns.append(f'{jid}: LOCKED entry has no Deep Dive narrative')
        fam = text(r.get('Family'))
        if not fam:
            warns.append(f'{jid}: no Family')
        refs = [x.strip() for x in (text(r.get('Source references')) or '').split(';') if x.strip()]
        srcs = []
        for x in refs:
            if x in S:
                srcs.append(S[x])
            else:
                warns.append(f'{jid}: source {x} is not in the JewHate Sources tab')
        rel = []
        for x in [y.strip() for y in (text(r.get('Related JH IDs')) or '').split(';') if y.strip()]:
            if status.get(x) in PUBLIC:
                rel.append(x)
                if status.get(x) != 'LOCKED':
                    warns.append(f'{jid}: related entry {x} is {status.get(x)}; the page links to it only with ?drafts=1')
            else:
                warns.append(f'{jid}: related entry {x} is not public, link dropped')
        yr = year_of(r.get('First documented appearance year'))
        appr = str(r.get('Approximate date')).strip().upper() == 'TRUE' if r.get('Approximate date') is not None else None
        e = {
            'id': jid, 'status': st, 'order': int(float(r['Display order'])) if r.get('Display order') is not None else None,
            'title': text(r.get('Title')), 'shortLabel': text(r.get('Short label')), 'family': fam,
            'lie': lie, 'record': record, 'significance': text(r.get('Historical significance (concise)')), 'cardSummary': text(r.get('Card summary')),
            'year': yr, 'approx': appr if yr is not None else None,
            'geoOrigin': text(r.get('Geographic origin')), 'originator': text(r.get('Originator (if known)')),
            'circumstances': text(r.get('Historical circumstances')), 'documentedMotive': text(r.get('Documented motive')),
            'inferredMotive': text(r.get('Inferred motive')), 'spread': text(r.get('How it spread')), 'uses': text(r.get('Major historical uses')),
            'consequences': text(r.get('Documented consequences')), 'evolution': text(r.get('Evolution over time')),
            'modern': text(r.get('Modern manifestations')), 'detailedCorrection': text(r.get('Detailed historical correction')),
            'deepDive': deep, 'related': rel, 'sources': srcs,
        }
        entries.append({k: v for k, v in e.items() if v is not None and v != []})
    entries.sort(key=lambda e: (e.get('order') is None, e.get('order') or 0, e['id']))
    orders = [e['order'] for e in entries if 'order' in e]
    if len(orders) != len(set(orders)):
        warns.append('Display order has duplicates')
    for e in entries:
        for s in e.get('sources', []):
            if not s.get('url'):
                warns.append(f"{e['id']}: source {s['id']} has no URL (shown without a link)")
    no_short = [e['id'] for e in entries if not e.get('shortLabel')]

    out = {
        'schema': 'jewhate-1', 'source': 'Google Sheet ' + a.sheet_name, 'sheetModified': a.sheet_modified,
        'exportSha256': hashlib.sha256(xlsx.read_bytes()).hexdigest()[:16],
        'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'entries': entries,
    }
    fams = {}
    for e in entries:
        if e['status'] == 'LOCKED':
            fams[e.get('family')] = fams.get(e.get('family'), 0) + 1
    print(f"Loaded {xlsx.name}: {len(jh)} JewHate rows, {len(S)} sources")
    print(f"Written entries: {len(entries)} ({sum(1 for e in entries if e['status']=='LOCKED')} LOCKED, {sum(1 for e in entries if e['status']=='LEANING')} LEANING); not written: {dropped}")
    print('LOCKED per family:', fams)
    print(f'Entries with no Short label (the page shows the Title instead): {len(no_short)}')
    print(f'Warnings: {len(warns)}')
    for w in warns:
        print('  warn  ' + w)
    if a.report:
        Path(a.report).write_text(json.dumps({'warnings': warns, 'notWritten': dropped, 'lockedPerFamily': fams, 'noShortLabel': no_short}, indent=1))
    if a.dry_run:
        print('Dry run: nothing written.')
        return
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print('Wrote ' + a.out)


if __name__ == '__main__':
    main()

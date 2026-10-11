#!/usr/bin/env python3
"""One-time seed for the Roadmap page: reads the roadmap CSV and prints SQL for the D1 database 'journeysquiz'.
The CSV and the SQL it produces are NOT committed (the roadmap rows must not sit in the repo). Keep both out of git.

Usage:  python3 tools/roadmap_seed.py roadmap-seed.csv > roadmap_seed.sql
Then apply roadmap_seed.sql to the database (D1 console, or ask Claude to apply it through the Cloudflare connector).
Needs the tables from worker/roadmap.sql first. Safe to run once: it refuses to overwrite rows that already exist (INSERT, not REPLACE).
Header must be: id,feature,about,area,rec,mine,status,deps,gate,effort,owner,source,notes,order,priority   (priority stays blank).
"""
import csv, json, sys

COLS = ['feature', 'about', 'area', 'rec', 'mine', 'status', 'deps', 'gate', 'effort', 'owner', 'source', 'notes', 'priority']
if len(sys.argv) != 2:
    sys.exit(__doc__)
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8-sig', newline='')))
need = ['id'] + COLS + ['order']
if not rows or any(c not in rows[0] for c in need):
    sys.exit('CSV header must contain: ' + ','.join(need))
q = lambda s: "'" + s.replace("'", "''") + "'"
snap, out = [], ['-- Roadmap seed (generated; do not commit)', 'BEGIN TRANSACTION;']
seen = set()
for i, r in enumerate(rows, 1):
    rid = r['id'].strip()
    if not rid or rid in seen:
        sys.exit('row %d: missing or duplicate id %r' % (i, rid))
    seen.add(rid)
    if r['priority'].strip():
        sys.exit('row %d (%s): priority must be blank in the seed (only the admin sets it)' % (i, rid))
    rec = {'id': rid}
    for c in COLS:
        rec[c] = (r[c] or '').strip()
    rec['sort_order'] = int(r['order']) if (r['order'] or '').strip().isdigit() else i
    snap.append(rec)
    out.append('INSERT INTO roadmap_features (id, ' + ', '.join(COLS) + ', sort_order) VALUES (' + ', '.join([q(rid)] + [q(rec[c]) for c in COLS] + [str(rec['sort_order'])]) + ');')
out.append("INSERT INTO roadmap_versions (saved_at, saved_by_label, summary, snapshot) VALUES (strftime('%Y-%m-%dT%H:%M:%SZ','now'), '', 'Seeded from roadmap table, October 10, 2026', " + q(json.dumps(snap, ensure_ascii=False)) + ');')
out.append('COMMIT;')
print('\n'.join(out))
sys.stderr.write('%d rows\n' % len(snap))

CREATE TABLE IF NOT EXISTS roadmap_features (
  id TEXT PRIMARY KEY,                           -- F-###
  feature TEXT NOT NULL DEFAULT '', about TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '',
  rec TEXT NOT NULL DEFAULT '',                  -- version Claude recommends
  mine TEXT NOT NULL DEFAULT '',                 -- version Jeffrey chose
  status TEXT NOT NULL DEFAULT '', deps TEXT NOT NULL DEFAULT '', gate TEXT NOT NULL DEFAULT '',
  effort TEXT NOT NULL DEFAULT '', owner TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',             -- set only by the admin (P1, P2, P3 or blank)
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS roadmap_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_at TEXT NOT NULL,                        -- UTC
  saved_by_label TEXT NOT NULL DEFAULT '',       -- optional free-text name
  summary TEXT NOT NULL,
  snapshot TEXT NOT NULL                         -- full JSON of all rows after the change
);
CREATE TABLE IF NOT EXISTS site_links (name TEXT PRIMARY KEY, url TEXT NOT NULL);   -- e.g. name 'strategy' = the Slides link (keep it out of the repo)
CREATE TABLE IF NOT EXISTS gate_fail (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));

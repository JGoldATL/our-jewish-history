-- D1 database "journeysquiz". Already created in Cloudflare; kept here so the setup is documented and repeatable.
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  visit_id TEXT NOT NULL,                       -- random per page visit, kept only in memory; test visits start with "test-"
  kind TEXT NOT NULL CHECK (kind IN ('answer','survey')),
  question_id TEXT, era TEXT, style TEXT,
  picked TEXT,                                  -- choice number, or the tap order for ordering questions (e.g. "2,0,1")
  correct INTEGER CHECK (correct IN (0,1)),
  round_id TEXT,                                -- v0.4.3: random per round of 3 (null on older rows)
  survey TEXT                                   -- A lot / Somewhat / Not really (latest tap per visit counts)
);
CREATE INDEX IF NOT EXISTS idx_responses_visit ON responses(visit_id);

-- Lock table: the real definition of every approved question. The Worker trusts this, never the browser.
-- Fill it with:  python3 tools/question_lock.py > worker/question_lock.sql   then apply that file to the database.
-- A question missing here is refused (fail closed), so re-apply after the question bank changes.
CREATE TABLE IF NOT EXISTS question_lock (
  id TEXT PRIMARY KEY, era TEXT NOT NULL, style TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mc','order')),
  n INTEGER NOT NULL CHECK (n BETWEEN 2 AND 5),
  correct_idx INTEGER                           -- multiple choice: index of the right choice; ordering questions: NULL (right = 0,1,2,...)
);
CREATE INDEX IF NOT EXISTS idx_responses_ts ON responses(ts);

-- v0.4.3 migration for an existing database (already applied to journeysquiz):
-- ALTER TABLE responses ADD COLUMN round_id TEXT;

-- v0.5.0 feedback page: anonymous messages. Create with:  see worker/feedback.sql (apply to journeysquiz before pasting the new Worker).
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  visit_id TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('Idea','Problem','Question','Praise')),
  message TEXT NOT NULL,
  image TEXT                                    -- optional photo or screenshot: a JPEG data URL, shrunk by the page (null when none)
);
CREATE INDEX IF NOT EXISTS idx_feedback_visit ON feedback(visit_id);

-- v0.5.0 roadmap, gate and private links. Rows are NOT in the repo: the roadmap is seeded once from a CSV by
--   python3 tools/roadmap_seed.py roadmap-seed.csv > roadmap_seed.sql   (keep that output out of git; apply it to journeysquiz).
-- Secrets ROADMAP_CODE and ROADMAP_ADMIN are Worker secrets set by Jeffrey in Cloudflare. Never write them in a file.
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
CREATE TABLE IF NOT EXISTS roadmap_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  feature_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS roadmap_comments_feature ON roadmap_comments (feature_id);
CREATE TABLE IF NOT EXISTS roadmap_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  name TEXT NOT NULL DEFAULT '', feature TEXT NOT NULL, accomplishes TEXT NOT NULL, about TEXT NOT NULL DEFAULT '', vision TEXT NOT NULL DEFAULT ''
);

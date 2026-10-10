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

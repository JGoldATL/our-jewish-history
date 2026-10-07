-- D1 database "journeysquiz". Already created in Cloudflare; kept here so the setup is documented and repeatable.
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  visit_id TEXT NOT NULL,                       -- random per page visit, kept only in memory; test visits start with "test-"
  kind TEXT NOT NULL CHECK (kind IN ('answer','survey')),
  question_id TEXT, era TEXT, style TEXT,
  picked TEXT,                                  -- choice number, or the tap order for ordering questions (e.g. "2,0,1")
  correct INTEGER CHECK (correct IN (0,1)),
  survey TEXT                                   -- A lot / Somewhat / Not really (latest tap per visit counts)
);
CREATE INDEX IF NOT EXISTS idx_responses_visit ON responses(visit_id);

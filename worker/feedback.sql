CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  visit_id TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('Idea','Problem','Question','Praise')),
  message TEXT NOT NULL,
  image TEXT                                    -- optional photo or screenshot: a JPEG data URL, shrunk by the page (null when none)
);
CREATE INDEX IF NOT EXISTS idx_feedback_visit ON feedback(visit_id);

-- v0.6.0 visitor insights: one row per quiz visit. Created once in Cloudflare (see worker/visits.sql). No IP address and no raw User-Agent are stored.
CREATE TABLE IF NOT EXISTS visits (
  visit_id TEXT PRIMARY KEY, first_ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  device_id TEXT,                 -- random id saved in the browser; the same value on a later visit means the same device
  country TEXT, region TEXT, city TEXT,   -- from Cloudflare, coarse
  device_type TEXT, browser TEXT, os TEXT, lang TEXT, tz TEXT, screen TEXT, ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_device ON visits(device_id);

-- Archive (prepared for a later release; do NOT run until that release is approved).
-- Run ONCE in Cloudflare D1 (journeysquiz) BEFORE pasting the matching worker.js: the new Worker reads these columns, and the old Worker ignores them.
-- ALTER TABLE ADD COLUMN is not repeatable; a second run errors with "duplicate column name", which is harmless.
ALTER TABLE roadmap_comments ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE roadmap_comments ADD COLUMN archived_ts TEXT;
ALTER TABLE roadmap_suggestions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE roadmap_suggestions ADD COLUMN archived_ts TEXT;
ALTER TABLE feedback ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feedback ADD COLUMN archived_ts TEXT;

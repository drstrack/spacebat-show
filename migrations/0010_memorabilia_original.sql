-- Additive. The panel image stays in url. original_url is the untouched
-- HEIC/HEIF when the panel shows a full-resolution display copy.
--
-- libSQL/SQLite rejects `ADD COLUMN IF NOT EXISTS`. These are plain ADD
-- COLUMN statements. The Turso runner checks PRAGMA table_info and skips a
-- column that already exists, then records this file only after both succeed.
alter table memorabilia_frame add column original_url text;

alter table memorabilia_frame add column original_pathname text;

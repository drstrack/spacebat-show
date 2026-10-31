-- Additive. The panel image stays in url. original_url is the untouched
-- HEIC/HEIF when the panel shows a full-resolution display copy.
alter table memorabilia_frame add column if not exists original_url text;

alter table memorabilia_frame add column if not exists original_pathname text;

-- One-off moves and cancellations of the standing Wednesday 8:30 PM ET show.
-- Admins write rows at /admin/schedule. A row is ignored after midnight
-- America/New_York on the day after the later of skip_date and the
-- replacement show. Ordinary weeks have no row.
--
-- skip_date: the America/New_York date with no regular show (YYYY-MM-DD).
-- show_start: the replacement start, or null when that night is cancelled.
-- note: the sentence on the site, in welcome mail, and in the skip-morning email.

create table if not exists show_schedule_override (
  skip_date text primary key,
  show_start timestamptz,
  note text not null,
  created_at timestamptz not null default now()
);

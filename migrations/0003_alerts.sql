-- One row per podcast-alert email we already sent, so a cron retry does not double-send.

create table if not exists alert_log (
  kind text not null,
  ref text not null,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref, email)
);

create table if not exists chat_live_state (
  room text primary key,
  is_live integer not null default 0,
  since_ms bigint,
  source text,
  manual text,
  manual_until_ms bigint,
  off_checks integer not null default 0,
  checked_ms bigint not null default 0,
  last_alert_ms bigint
);

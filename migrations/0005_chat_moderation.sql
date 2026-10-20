create table if not exists chat_report (
  id bigserial primary key,
  message_id bigint not null,
  reporter_id text not null,
  reason text not null,
  created_ms bigint not null,
  resolved_ms bigint,
  resolved_by text,
  resolution text,
  unique (message_id, reporter_id)
);

create index if not exists chat_report_open_idx on chat_report (resolved_ms, created_ms);

create table if not exists chat_audit (
  id bigserial primary key,
  actor_id text not null,
  action text not null,
  target_user_id text,
  message_id bigint,
  detail text,
  created_ms bigint not null
);

create table if not exists chat_blockword (
  word text primary key,
  added_by text not null,
  created_ms bigint not null
);

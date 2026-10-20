create table if not exists chat_member (
  user_id text primary key references "user" ("id") on delete cascade,
  handle text not null,
  handle_key text not null unique,
  rules_version integer not null default 0,
  rules_accepted_ms bigint,
  muted_until_ms bigint,
  banned_ms bigint,
  ban_reason text,
  created_ms bigint not null
);

create table if not exists chat_message (
  id bigserial primary key,
  room text not null default 'main',
  user_id text,
  kind text not null default 'text',
  body text not null,
  created_ms bigint not null,
  deleted_ms bigint,
  deleted_by text,
  event_key text unique
);

create index if not exists chat_message_room_id_idx on chat_message (room, id);

create index if not exists chat_message_user_idx on chat_message (user_id, created_ms);

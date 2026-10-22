create table if not exists chat_presence (
  user_id text primary key,
  room text not null default 'main',
  last_seen_ms bigint not null,
  state text not null,
  session_ms bigint,
  left_ms bigint
);

create index if not exists chat_presence_room_seen_idx
  on chat_presence (room, state, last_seen_ms);

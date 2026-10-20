create table if not exists chat_upload (
  id bigserial primary key,
  message_id bigint,
  user_id text not null,
  url text not null,
  pathname text not null unique,
  original_name text not null,
  size bigint not null,
  content_type text not null,
  kind text not null,
  created_ms bigint not null,
  deleted_ms bigint
);

create index if not exists chat_upload_message_idx on chat_upload (message_id);

create index if not exists chat_upload_user_created_idx on chat_upload (user_id, created_ms);

create index if not exists chat_upload_created_idx on chat_upload (created_ms);

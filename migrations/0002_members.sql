-- Listener accounts, newsletter lists, and visit counts for the crew desk.

create table if not exists member_profile (
  user_id text primary key references "user" ("id") on delete cascade,
  role text not null default 'listener',
  podcast_alerts boolean not null default true,
  show_letter boolean not null default false,
  merch_letter boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists page_view (
  id bigserial primary key,
  path text not null,
  day date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists page_view_day_idx on page_view (day);
create index if not exists page_view_path_idx on page_view (path);

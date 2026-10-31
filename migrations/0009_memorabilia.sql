-- John's comic memorabilia. Additive: new table only, no changes to existing tables.
-- Frame 1 is a static file under public/memorabilia, not a row here.

create table if not exists memorabilia_frame (
  id bigserial primary key,
  url text not null,
  pathname text not null unique,
  alt_text text not null,
  caption text not null default '',
  sort_order integer not null,
  created_ms bigint not null,
  created_by text
);

create index if not exists memorabilia_frame_sort_idx on memorabilia_frame (sort_order, id);

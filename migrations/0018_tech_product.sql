-- Products John and Dan use and recommend. Public read, admin write.
-- Additive and race-safe: a new table only, created if it is missing.
-- image_source stays 'custom' when a host uploads or pastes a picture,
-- so a later fetch of product_url refreshes auto_image_url only.
-- 0017 is the media_rating rebuild. This file is 0018 and does not touch that table.

create table if not exists tech_product (
  id text primary key,
  name text not null,
  description text not null default '',
  product_url text not null,
  image_url text,
  image_source text not null default 'auto' check (image_source in ('auto', 'custom')),
  auto_image_url text,
  recommended_by text check (recommended_by is null or recommended_by in ('john', 'dan', 'both')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tech_product_sort_idx on tech_product (sort_order, created_at);

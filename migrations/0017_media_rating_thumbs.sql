-- Widen media_rating so a host can store four_up and three_up.
-- SQLite cannot alter a CHECK, so this rebuilds the table.
-- The new table matches the old one except the rating check.
-- insert into media_rating_new select * from media_rating copies every
-- column as stored. This file does not update a rating value.
--
-- The Turso runner does not apply a multi-statement file as one transaction:
-- each statement is its own execute(), and on Turso that is its own request.
-- src/lib/sqlite-migrate.ts applies this file inside one immediate write
-- transaction, repairs a leftover media_rating_new, and commits only when
-- the copied rows match the table it started with. A later run sees the
-- widened check and does not rebuild.

create table if not exists media_rating_new (
  media_item_id text not null references media_item (id) on delete cascade,
  host text not null check (host in ('john', 'dan')),
  rating text not null check (
    rating in (
      'four_up',
      'three_up',
      'two_up',
      'one_up',
      'ok',
      'one_down',
      'two_down',
      'not_seen'
    )
  ),
  updated_at bigint not null,
  primary key (media_item_id, host)
);

delete from media_rating_new;

insert into media_rating_new select * from media_rating;

drop table media_rating;

alter table media_rating_new rename to media_rating;

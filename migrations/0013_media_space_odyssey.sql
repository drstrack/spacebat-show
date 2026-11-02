-- Add 2001: A Space Odyssey once. Existing titles and ratings stay as they are.
-- media_seed id 2 is the once-only marker. Deleting this title does not remove
-- the marker, so a later boot does not insert it again.

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, imdb_id, overview, poster_path,
  best_guess, episodes, sort_rank, created_at, updated_at
)
select
  '2001-a-space-odyssey',
  'movie',
  '2001: A Space Odyssey',
  '1968',
  'https://en.wikipedia.org/wiki/2001%3A_A_Space_Odyssey',
  62,
  'movie',
  'tt0062622',
  'Humanity finds a mysterious object buried beneath the lunar surface and sets off to find its origins with the help of HAL 9000, the world''s most advanced super computer.',
  '/ve72VxNqjGM69Uky4WTo2bK6rfq.jpg',
  0,
  '[]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 2)
  and not exists (select 1 from media_item where id = '2001-a-space-odyssey')
  and not exists (select 1 from media_item where tmdb_id = 62)
  and not exists (
    select 1 from media_item
    where lower(title) in ('2001: a space odyssey', '2001 a space odyssey')
  );

insert into media_seed (id, note)
select 2, '2001-a-space-odyssey'
where not exists (select 1 from media_seed where id = 2);

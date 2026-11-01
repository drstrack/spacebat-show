-- Frame 1 is a normal row, served from public/memorabilia. No Blob upload.
-- memorabilia_seed is the once-only marker. Deleting the frame does not
-- remove the marker, so a later boot does not insert the picture again.
-- libSQL rejects ADD COLUMN IF NOT EXISTS. The Turso runner skips a column
-- that is already there.

create table if not exists memorabilia_seed (
  id integer primary key,
  note text not null
);

alter table memorabilia_frame add column width integer;

alter table memorabilia_frame add column height integer;

insert into memorabilia_frame (
  url,
  pathname,
  alt_text,
  caption,
  sort_order,
  created_ms,
  created_by,
  width,
  height
)
select
  '/memorabilia/frame-01-batman-statue-v2.jpg',
  'static/frame-01-batman-statue-v2.jpg',
  'A large blue-and-grey Batman statue on a Batcave-style base, with several small Batman busts around it, on a wooden coffee table.',
  'Batman, on the Batcave base.',
  0,
  1761960287000,
  null,
  921,
  1038
where not exists (select 1 from memorabilia_seed where id = 1)
  and not exists (
    select 1 from memorabilia_frame
    where pathname = 'static/frame-01-batman-statue-v2.jpg'
  );

insert into memorabilia_seed (id, note)
select 1, 'frame-01'
where not exists (select 1 from memorabilia_seed where id = 1);

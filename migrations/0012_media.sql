-- Movies and TV discussed on SpaceBat. Additive: new tables only.
-- media_seed is the once-only marker. Deleting a title does not remove the
-- marker, so a later boot does not insert the catalog again.
-- A missing media_rating row means that host has not seen it.

create table if not exists media_item (
  id text primary key,
  kind text not null check (kind in ('movie', 'tv')),
  title text not null,
  year text not null default '',
  wikipedia_url text,
  tmdb_id integer,
  tmdb_type text check (tmdb_type is null or tmdb_type in ('movie', 'tv')),
  imdb_id text,
  overview text,
  poster_path text,
  image text,
  image_credit text,
  image_kind text check (image_kind is null or image_kind in ('poster', 'logo', 'still')),
  width integer,
  height integer,
  best_guess integer not null default 0,
  best_guess_reason text,
  episodes text not null default '[]',
  sort_rank integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists media_item_kind_idx on media_item (kind, sort_rank, title);

create table if not exists media_rating (
  media_item_id text not null references media_item (id) on delete cascade,
  host text not null check (host in ('john', 'dan')),
  rating text not null check (rating in ('two_up', 'one_up', 'ok', 'one_down', 'two_down', 'not_seen')),
  updated_at bigint not null,
  primary key (media_item_id, host)
);

create table if not exists media_seed (
  id integer primary key,
  note text not null
);

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'avengers-doomsday', 'movie', 'Avengers: Doomsday', '2026', 'https://en.wikipedia.org/wiki/Avengers%3A_Doomsday',
  '/media/avengers-doomsday.jpg', 'Poster © Walt Disney Studios Motion Pictures — via Wikipedia', 'poster',
  250, 377, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"}]', 4, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'avengers-doomsday');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'spider-man-brand-new-day', 'movie', 'Spider-Man: Brand New Day', '2026', 'https://en.wikipedia.org/wiki/Spider-Man%3A_Brand_New_Day',
  '/media/spider-man-brand-new-day.jpg', 'Poster © Sony Pictures Releasing — via Wikipedia', 'poster',
  258, 387, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"},{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad"}]', 3, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'spider-man-brand-new-day');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'leave-the-world-behind', 'movie', 'Leave the World Behind', '2023', 'https://en.wikipedia.org/wiki/Leave_the_World_Behind_(film)',
  '/media/leave-the-world-behind.png', 'Poster © Netflix — via Wikipedia', 'poster',
  250, 370, 0, null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'leave-the-world-behind');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'strange-days', 'movie', 'Strange Days', '1995', 'https://en.wikipedia.org/wiki/Strange_Days_(film)',
  '/media/strange-days.jpeg', 'Poster © 20th Century Fox — via Wikipedia', 'poster',
  250, 376, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'strange-days');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'dark-city', 'movie', 'Dark City', '1998', 'https://en.wikipedia.org/wiki/Dark_City_(1998_film)',
  '/media/dark-city.jpg', 'Poster © New Line Cinema — via Wikipedia', 'poster',
  253, 393, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'dark-city');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'clayface', 'movie', 'Clayface', '2026', 'https://en.wikipedia.org/wiki/Clayface_(film)',
  '/media/clayface.jpg', 'Poster © Warner Bros. Pictures — via Wikipedia', 'poster',
  250, 370, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'clayface');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'star-wars-starfighter', 'movie', 'Star Wars: Starfighter', '2027 (upcoming)', 'https://en.wikipedia.org/wiki/Star_Wars%3A_Starfighter',
  '/media/star-wars-starfighter.jpg', 'Logo © Walt Disney Studios Motion Pictures — via Wikipedia', 'logo',
  385, 260, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'star-wars-starfighter');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'andor', 'tv', 'Andor', '2022–2025', 'https://en.wikipedia.org/wiki/Andor',
  '/media/andor.png', 'Logo © Disney+ — via Wikipedia', 'logo',
  400, 179, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"},{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch"},{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'andor');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'star-wars-ahsoka', 'tv', 'Star Wars: Ahsoka', '2023–', 'https://en.wikipedia.org/wiki/Star_Wars%3A_Ahsoka',
  '/media/star-wars-ahsoka.png', 'Logo © Disney+ — via Wikipedia', 'logo',
  400, 114, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"}]', 4, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'star-wars-ahsoka');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-mandalorian', 'tv', 'The Mandalorian', '2019–2023', 'https://en.wikipedia.org/wiki/The_Mandalorian',
  null, null, null,
  null, null, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"}]', 4, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-mandalorian');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'lioness', 'tv', 'Lioness', '2023–', 'https://en.wikipedia.org/wiki/Lioness_(American_TV_series)',
  '/media/lioness.jpg', 'Poster © Paramount+ — via Wikipedia', 'poster',
  400, 225, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"}]', 4, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'lioness');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'ted-lasso', 'tv', 'Ted Lasso', '2020–', 'https://en.wikipedia.org/wiki/Ted_Lasso',
  '/media/ted-lasso.jpg', 'Poster © Apple TV+ — via Wikipedia', 'poster',
  400, 200, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"},{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad"}]', 3, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'ted-lasso');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'loki', 'tv', 'Loki', '2021–2023', 'https://en.wikipedia.org/wiki/Loki_(TV_series)',
  '/media/loki.png', 'Logo © Disney+ — via Wikipedia', 'logo',
  400, 224, 0, null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove"},{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch"},{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'loki');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'wandavision', 'tv', 'WandaVision', '2021', 'https://en.wikipedia.org/wiki/WandaVision',
  '/media/wandavision.png', 'Logo © Disney+ — via Wikipedia', 'logo',
  400, 230, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'wandavision');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'visionquest', 'tv', 'VisionQuest', '2026', 'https://en.wikipedia.org/wiki/VisionQuest',
  '/media/visionquest.jpg', 'Logo © Marvel Studios — via Wikipedia', 'logo',
  387, 258, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'visionquest');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'lanterns', 'tv', 'Lanterns', '2026', 'https://en.wikipedia.org/wiki/Lanterns_(TV_series)',
  '/media/lanterns.jpg', 'Poster © HBO — via Wikipedia', 'poster',
  400, 225, 0, null,
  '[{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad"}]', 3, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'lanterns');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-diplomat', 'tv', 'The Diplomat', '2023–', 'https://en.wikipedia.org/wiki/The_Diplomat_(American_TV_series)',
  '/media/the-diplomat.png', 'Logo © Netflix — via Wikipedia', 'logo',
  400, 72, 0, null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-diplomat');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-terminal-list', 'tv', 'The Terminal List', '2022–', 'https://en.wikipedia.org/wiki/The_Terminal_List',
  '/media/the-terminal-list.jpeg', 'Poster © Amazon Prime Video — via Wikipedia', 'poster',
  280, 350, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-terminal-list');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'slow-horses', 'tv', 'Slow Horses', '2022–', 'https://en.wikipedia.org/wiki/Slow_Horses',
  '/media/slow-horses.png', 'Logo © Apple TV+ — via Wikipedia', 'logo',
  400, 85, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'slow-horses');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'blade-runner-2099', 'tv', 'Blade Runner 2099', 'upcoming', 'https://en.wikipedia.org/wiki/Blade_Runner_2099',
  '/media/blade-runner-2099.jpg', 'Poster © Amazon Prime Video — via Wikipedia', 'poster',
  282, 353, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'blade-runner-2099');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'reacher', 'tv', 'Reacher', '2022–', 'https://en.wikipedia.org/wiki/Reacher_(TV_series)',
  '/media/reacher.png', 'Logo © Amazon Prime Video — via Wikipedia', 'logo',
  400, 225, 0, null,
  '[{"slug":"episode-zero-grok-bots-geopolitics-and-the-bat-signal","title":"Episode Zero: Grok Bots, Geopolitics, and the Bat Signal"}]', 5, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'reacher');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'i-robot', 'movie', 'I, Robot', '2004', 'https://en.wikipedia.org/wiki/I%2C_Robot_(film)',
  '/media/i-robot.jpg', 'Poster © 20th Century Fox — via Wikipedia', 'poster',
  260, 385, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"00:59:00"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'i-robot');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'batman-returns', 'movie', 'Batman Returns', '1992', 'https://en.wikipedia.org/wiki/Batman_Returns',
  '/media/batman-returns.jpg', 'Poster © Warner Bros. — via Wikipedia', 'poster',
  248, 367, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:28:31"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'batman-returns');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-old-man-the-gun', 'movie', 'The Old Man & the Gun', '2018', 'https://en.wikipedia.org/wiki/The_Old_Man_%26_the_Gun',
  '/media/the-old-man-the-gun.png', 'Poster © Fox Searchlight Pictures — via Wikipedia', 'poster',
  220, 326, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:35:02"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-old-man-the-gun');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-nice-guys', 'movie', 'The Nice Guys', '2016', 'https://en.wikipedia.org/wiki/The_Nice_Guys',
  '/media/the-nice-guys.png', 'Poster © Warner Bros. Pictures — via Wikipedia', 'poster',
  259, 384, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:46:24"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-nice-guys');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'bullet-train', 'movie', 'Bullet Train', '2022', 'https://en.wikipedia.org/wiki/Bullet_Train_(film)',
  '/media/bullet-train.jpeg', 'Poster © Sony Pictures Releasing — via Wikipedia', 'poster',
  250, 371, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:57:33"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'bullet-train');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'watchmen', 'movie', 'Watchmen', '2009', 'https://en.wikipedia.org/wiki/Watchmen_(2009_film)',
  '/media/watchmen.jpg', 'Poster © Warner Bros. Pictures — via Wikipedia', 'poster',
  259, 384, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:01:20"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'watchmen');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'green-lantern', 'movie', 'Green Lantern', '2011', 'https://en.wikipedia.org/wiki/Green_Lantern_(film)',
  '/media/green-lantern.jpg', 'Poster © Warner Bros. Pictures — via Wikipedia', 'poster',
  259, 384, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:08:37"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'green-lantern');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'alien', 'movie', 'Alien', '1979', 'https://en.wikipedia.org/wiki/Alien_(film)',
  '/media/alien.jpg', 'Poster © 20th Century-Fox — via Wikipedia', 'poster',
  250, 382, 0, null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:55:15"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'alien');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'aliens', 'movie', 'Aliens', '1986', 'https://en.wikipedia.org/wiki/Aliens_(film)',
  '/media/aliens.jpg', 'Poster © 20th Century Fox — via Wikipedia', 'poster',
  220, 343, 0, null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:55:15"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'aliens');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'vanilla-sky', 'movie', 'Vanilla Sky', '2001', 'https://en.wikipedia.org/wiki/Vanilla_Sky',
  '/media/vanilla-sky.png', 'Poster © Paramount Pictures — via Wikipedia', 'poster',
  250, 366, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"00:22:38"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'vanilla-sky');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'mercy', 'movie', 'Mercy', '2026', 'https://en.wikipedia.org/wiki/Mercy_(2026_film)',
  '/media/mercy.jpeg', 'Poster © Amazon MGM Studios — via Wikipedia', 'poster',
  259, 383, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:20:06"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'mercy');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'resident-evil', 'movie', 'Resident Evil', '2026', 'https://en.wikipedia.org/wiki/Resident_Evil_(2026_film)',
  '/media/resident-evil.png', 'Poster © Sony Pictures Releasing — via Wikipedia', 'poster',
  260, 385, 0, null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:42:50"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'resident-evil');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'fail-safe', 'movie', 'Fail Safe', '1964', 'https://en.wikipedia.org/wiki/Fail_Safe_(1964_film)',
  '/media/fail-safe.jpg', 'Poster © Columbia Pictures — via Wikipedia', 'poster',
  257, 386, 0, null,
  '[{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad","timestamp":"00:37:41"}]', 3, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'fail-safe');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'broken-arrow', 'movie', 'Broken Arrow', '1996', 'https://en.wikipedia.org/wiki/Broken_Arrow_(1996_film)',
  '/media/broken-arrow.jpg', 'Poster © 20th Century Fox — via Wikipedia', 'poster',
  249, 367, 0, null,
  '[{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad","timestamp":"00:39:03"}]', 3, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'broken-arrow');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'project-hail-mary', 'movie', 'Project Hail Mary', '2026', 'https://en.wikipedia.org/wiki/Project_Hail_Mary_(film)',
  '/media/project-hail-mary.jpg', 'Poster © Amazon MGM Studios — via Wikipedia', 'poster',
  260, 385, 0, null,
  '[{"slug":"episode-zero-grok-bots-geopolitics-and-the-bat-signal","title":"Episode Zero: Grok Bots, Geopolitics, and the Bat Signal","timestamp":"00:02:11"}]', 5, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'project-hail-mary');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'gran-turismo', 'movie', 'Gran Turismo', '2023', 'https://en.wikipedia.org/wiki/Gran_Turismo_(film)',
  '/media/gran-turismo.jpeg', 'Poster © Sony Pictures Releasing — via Wikipedia', 'poster',
  256, 384, 0, null,
  '[{"slug":"episode-zero-grok-bots-geopolitics-and-the-bat-signal","title":"Episode Zero: Grok Bots, Geopolitics, and the Bat Signal","timestamp":"00:54:29"}]', 5, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'gran-turismo');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'fallout', 'tv', 'Fallout', '2024–', 'https://en.wikipedia.org/wiki/Fallout_(American_TV_series)',
  '/media/fallout.png', 'Logo © Amazon Prime Video — via Wikipedia', 'logo',
  400, 160, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:05:04"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'fallout');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'halo', 'tv', 'Halo', '2022–2024', 'https://en.wikipedia.org/wiki/Halo_(TV_series)',
  '/media/halo.png', 'Logo © Paramount+ — via Wikipedia', 'logo',
  400, 65, 0, null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:05:22"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'halo');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-fifth-element', 'movie', 'The Fifth Element', '1997', 'https://en.wikipedia.org/wiki/The_Fifth_Element',
  '/media/the-fifth-element.jpg', 'Poster © Gaumont Buena Vista International — via Wikipedia', 'poster',
  220, 328, 1, '''One of the most spectacular sci fi movies ever… Bruce Willis… Gary Oldman'' only fits The Fifth Element',
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:43:39"}]', 2, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-fifth-element');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'alien-earth', 'tv', 'Alien: Earth', '2025–', 'https://en.wikipedia.org/wiki/Alien%3A_Earth',
  null, null, null,
  null, null, 1, '''a show… based on the actual alien movie series'' = the FX/Hulu Alien series',
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:54:46"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'alien-earth');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  '9-11-the-falling-man', 'movie', '9/11: The Falling Man', '2006', 'https://en.wikipedia.org/wiki/9%2F11%3A_The_Falling_Man',
  null, null, null,
  null, null, 1, '''a movie… the falling man'' in a 9/11 discussion = the 2006 documentary',
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"01:22:56"}]', 1, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = '9-11-the-falling-man');

insert into media_item (
  id, kind, title, year, wikipedia_url, image, image_credit, image_kind,
  width, height, best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-fantastic-four-first-steps', 'movie', 'The Fantastic Four: First Steps', '2025', 'https://en.wikipedia.org/wiki/The_Fantastic_Four%3A_First_Steps',
  '/media/the-fantastic-four-first-steps.jpg', 'Poster © Walt Disney Studios Motion Pictures — via Wikipedia', 'poster',
  259, 383, 1, 'Notes link marvel.com/movies/fantastic-four plus ''Galactus. That was the best part in the movie''',
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:12:57"}]', 0, 1762041600000, 1762041600000
where not exists (select 1 from media_seed where id = 1)
  and not exists (select 1 from media_item where id = 'the-fantastic-four-first-steps');

insert into media_seed (id, note)
select 1, 'catalog-43'
where not exists (select 1 from media_seed where id = 1);

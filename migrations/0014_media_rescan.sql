-- Add titles from the 2026-11-01 transcript rescan. Existing rows and ratings stay as they are.
-- media_seed id 3 is the once-only marker. Deleting one of these titles does not remove
-- the marker, so a later boot does not insert that title again.

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'blade-runner',
  'movie',
  'Blade Runner',
  '1982',
  'https://en.wikipedia.org/wiki/Blade_Runner',
  78,
  'movie',
  'In the smog-choked Los Angeles of 2019, blade runner Rick Deckard is called out of retirement to terminate four escaped replicants.',
  '/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:53:27"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'blade-runner')
  and not exists (select 1 from media_item where tmdb_id = 78 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Blade Runner') and year like '1982%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'blade-runner-2049',
  'movie',
  'Blade Runner 2049',
  '2017',
  'https://en.wikipedia.org/wiki/Blade_Runner_2049',
  335984,
  'movie',
  'Thirty years after the first film, a new blade runner unearths a buried secret and goes looking for former blade runner Rick Deckard.',
  '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:45:07"},{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:53:27"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'blade-runner-2049')
  and not exists (select 1 from media_item where tmdb_id = 335984 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Blade Runner 2049') and year like '2017%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-batman-part-ii',
  'movie',
  'The Batman: Part II',
  '2028 (upcoming)',
  'https://en.wikipedia.org/wiki/The_Batman:_Part_II',
  806704,
  'movie',
  'Sequel to the 2022 film The Batman.',
  '/r5fl4aMsmTjgc8DdDqQaM84roWp.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:29:46"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-batman-part-ii')
  and not exists (select 1 from media_item where tmdb_id = 806704 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Batman: Part II') and year like '2028%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'ghost-rider',
  'movie',
  'Ghost Rider',
  '2007',
  'https://en.wikipedia.org/wiki/Ghost_Rider_(2007_film)',
  1250,
  'movie',
  'Stunt cyclist Johnny Blaze sells his soul to save his father and is bound to the Spirit of Vengeance.',
  '/4quwR1VwZouD0YF9AaD72kQAjxH.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:08:43"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'ghost-rider')
  and not exists (select 1 from media_item where tmdb_id = 1250 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Ghost Rider') and year like '2007%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'superman',
  'movie',
  'Superman',
  '2025',
  'https://en.wikipedia.org/wiki/Superman_(2025_film)',
  1061474,
  'movie',
  'Clark Kent, a journalist in Metropolis, tries to reconcile his Kryptonian heritage with his human upbringing.',
  '/ldyfo0BKmz5rWtJJKCvwaNS4cJT.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:13:20"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'superman')
  and not exists (select 1 from media_item where tmdb_id = 1061474 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Superman') and year like '2025%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'man-of-steel',
  'movie',
  'Man of Steel',
  '2013',
  'https://en.wikipedia.org/wiki/Man_of_Steel_(film)',
  49521,
  'movie',
  'Clark Kent learns he is not of this Earth and has to become a symbol of hope to stop General Zod.',
  '/8GFtkImmK0K1VaUChR0n9O61CFU.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:13:35"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'man-of-steel')
  and not exists (select 1 from media_item where tmdb_id = 49521 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Man of Steel') and year like '2013%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-deer-hunter',
  'movie',
  'The Deer Hunter',
  '1978',
  'https://en.wikipedia.org/wiki/The_Deer_Hunter',
  11778,
  'movie',
  'Three steelworkers from a Pennsylvania town enlist and are sent to Vietnam.',
  '/bbGtogDZOg09bm42KIpCXUXICkh.jpg',
  0,
  null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"00:35:26"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-deer-hunter')
  and not exists (select 1 from media_item where tmdb_id = 11778 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Deer Hunter') and year like '1978%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-terminator',
  'movie',
  'The Terminator',
  '1984',
  'https://en.wikipedia.org/wiki/The_Terminator',
  218,
  'movie',
  'A cyborg assassin is sent from a machine-ruled future to kill Sarah Connor before her son can lead the human resistance.',
  '/qvktm0BHcnmDpul4Hz01GIazWPr.jpg',
  0,
  null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"00:26:35"},{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:39:29"},{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:50:25"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-terminator')
  and not exists (select 1 from media_item where tmdb_id = 218 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Terminator') and year like '1984%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'top-gun',
  'movie',
  'Top Gun',
  '1986',
  'https://en.wikipedia.org/wiki/Top_Gun',
  744,
  'movie',
  'Navy pilot Pete Mitchell trains at an elite fighter-weapons school.',
  '/xUuHj3CgmZQ9P2cMaqQs4J0d4Zc.jpg',
  0,
  null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:55:09"},{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"02:01:44"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'top-gun')
  and not exists (select 1 from media_item where tmdb_id = 744 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Top Gun') and year like '1986%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'team-america-world-police',
  'movie',
  'Team America: World Police',
  '2004',
  'https://en.wikipedia.org/wiki/Team_America:_World_Police',
  3989,
  'movie',
  'A puppet special-forces team is sent to stop a global terrorist plot.',
  '/m1Q2VFe1DVVbjfu1LDZe7tlp9yb.jpg',
  0,
  null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove","timestamp":"01:16:10"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'team-america-world-police')
  and not exists (select 1 from media_item where tmdb_id = 3989 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Team America: World Police') and year like '2004%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-acolyte',
  'tv',
  'The Acolyte',
  '2024',
  'https://en.wikipedia.org/wiki/The_Acolyte_(TV_series)',
  114479,
  'tv',
  'A century before the Empire, a Jedi investigation into a crime spree meets a warrior from a master''s past.',
  '/mztdt3y6GBsJR69zHtszFezTCLT.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:17:14"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-acolyte')
  and not exists (select 1 from media_item where tmdb_id = 114479 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Acolyte') and year like '2024%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'battlestar-galactica-1978',
  'tv',
  'Battlestar Galactica',
  '1978–1979',
  'https://en.wikipedia.org/wiki/Battlestar_Galactica_(1978_TV_series)',
  501,
  'tv',
  'After the Cylons destroy the Twelve Colonies, the battlestar Galactica leads the surviving fleet in search of Earth.',
  '/27jl4H9PauenZlmVBbOO1pr1lGf.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:51:58"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'battlestar-galactica-1978')
  and not exists (select 1 from media_item where tmdb_id = 501 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Battlestar Galactica') and year like '1978%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'battlestar-galactica-2004',
  'tv',
  'Battlestar Galactica',
  '2004–2009',
  'https://en.wikipedia.org/wiki/Battlestar_Galactica_(2004_TV_series)',
  1972,
  'tv',
  'After the Cylons wipe out the Twelve Colonies, the aging Galactica protects the last of humanity on the journey to Earth.',
  '/99PJSbcO2LeM10uOGWeFihNp77j.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:51:46"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'battlestar-galactica-2004')
  and not exists (select 1 from media_item where tmdb_id = 1972 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Battlestar Galactica') and year like '2004%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-birds',
  'tv',
  'The Birds',
  'upcoming',
  null,
  340379,
  'tv',
  'Upcoming HBO series with Sarah Snook, a remake of Alfred Hitchcock''s 1963 film about birds taking over a Northern California town.',
  null,
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:59:24"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-birds')
  and not exists (select 1 from media_item where tmdb_id = 340379 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Birds') and year like 'upcoming%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'below',
  'tv',
  'Below',
  '2026',
  null,
  285322,
  'tv',
  'A mysterious sea creature terrorizes a small Newfoundland town, and a fishing family tries to protect the community.',
  '/vgLqqhMUbljp585qPp1EFCyJtcz.jpg',
  1,
  'The transcript calls it a Netflix show named Below about a giant creature. This is the Netflix series about a sea creature in a Newfoundland town.',
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"00:20:38"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'below')
  and not exists (select 1 from media_item where tmdb_id = 285322 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Below') and year like '2026%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  '2010-the-year-we-make-contact',
  'movie',
  '2010: The Year We Make Contact',
  '1984',
  'https://en.wikipedia.org/wiki/2010:_The_Year_We_Make_Contact',
  4437,
  'movie',
  'A joint Soviet-American mission returns to the spacecraft Discovery and its computer HAL.',
  '/mEWKXuCMv7mFMxXVSTI3v8UOQuq.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:50:25"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = '2010-the-year-we-make-contact')
  and not exists (select 1 from media_item where tmdb_id = 4437 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('2010: The Year We Make Contact') and year like '1984%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'once-upon-a-time-in-the-west',
  'movie',
  'Once Upon a Time in the West',
  '1968',
  'https://en.wikipedia.org/wiki/Once_Upon_a_Time_in_the_West',
  335,
  'movie',
  'A railroad crew pushes across the Arizona desert as a stranger arrives in the town of Flagstone.',
  '/qbYgqOczabWNn2XKwgMtVrntD6P.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:48:36"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'once-upon-a-time-in-the-west')
  and not exists (select 1 from media_item where tmdb_id = 335 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Once Upon a Time in the West') and year like '1968%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'kraven-the-hunter',
  'movie',
  'Kraven the Hunter',
  '2024',
  'https://en.wikipedia.org/wiki/Kraven_the_Hunter_(film)',
  539972,
  'movie',
  'Kraven Kravinoff turns on his gangster father and becomes one of the world''s most feared hunters.',
  '/1GvBhRxY6MELDfxFrete6BNhBB5.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:56:56"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'kraven-the-hunter')
  and not exists (select 1 from media_item where tmdb_id = 539972 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Kraven the Hunter') and year like '2024%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'dr-no',
  'movie',
  'Dr. No',
  '1962',
  'https://en.wikipedia.org/wiki/Dr._No_(film)',
  646,
  'movie',
  'James Bond is sent to Jamaica to stop Dr. No from wrecking the U.S. space program.',
  '/9zCOLJmLNst0sCPZlkW1IRoH65E.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"01:56:14"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'dr-no')
  and not exists (select 1 from media_item where tmdb_id = 646 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Dr. No') and year like '1962%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-hunt-for-red-october',
  'movie',
  'The Hunt for Red October',
  '1990',
  'https://en.wikipedia.org/wiki/The_Hunt_for_Red_October_(film)',
  1669,
  'movie',
  'CIA analyst Jack Ryan believes a Soviet submarine captain is defecting rather than attacking.',
  '/yVl7zidse4KiWtGMqHFtZCx4X3N.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:23:15"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-hunt-for-red-october')
  and not exists (select 1 from media_item where tmdb_id = 1669 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Hunt for Red October') and year like '1990%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'mission-impossible',
  'movie',
  'Mission: Impossible',
  '1996',
  'https://en.wikipedia.org/wiki/Mission:_Impossible_(film)',
  954,
  'movie',
  'IMF agent Ethan Hunt is framed as a mole and has to expose the real traitor.',
  '/l5uxY5m5OInWpcExIpKG6AR3rgL.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:16:01"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'mission-impossible')
  and not exists (select 1 from media_item where tmdb_id = 954 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Mission: Impossible') and year like '1996%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'alien-vs-predator',
  'movie',
  'Alien vs. Predator',
  '2004',
  'https://en.wikipedia.org/wiki/Alien_vs._Predator_(film)',
  395,
  'movie',
  'A research team in Antarctica walks into a hunt where Aliens are bred as prey for Predators.',
  '/2DKoPom57PVtJWcJlq7bS7JpahU.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:54:07"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'alien-vs-predator')
  and not exists (select 1 from media_item where tmdb_id = 395 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Alien vs. Predator') and year like '2004%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'predator',
  'movie',
  'Predator',
  '1987',
  'https://en.wikipedia.org/wiki/Predator_(film)',
  106,
  'movie',
  'Commandos on a jungle mission are hunted by an extraterrestrial warrior.',
  '/k3mW4qfJo6SKqe6laRyNGnbB9n5.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:58:55"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'predator')
  and not exists (select 1 from media_item where tmdb_id = 106 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Predator') and year like '1987%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'avengers-secret-wars',
  'movie',
  'Avengers: Secret Wars',
  '2027 (upcoming)',
  'https://en.wikipedia.org/wiki/Avengers:_Secret_Wars',
  1003598,
  'movie',
  'The finale of the Marvel Cinematic Universe Multiverse Saga.',
  '/f0YBuh4hyiAheXhh4JnJWoKi9g5.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:49:54"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'avengers-secret-wars')
  and not exists (select 1 from media_item where tmdb_id = 1003598 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Avengers: Secret Wars') and year like '2027%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'batman-begins',
  'movie',
  'Batman Begins',
  '2005',
  'https://en.wikipedia.org/wiki/Batman_Begins',
  272,
  'movie',
  'Bruce Wayne builds the Batman identity to fight the corruption of Gotham.',
  '/sPX89Td70IDDjVr85jdSBb4rWGr.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:50:07"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'batman-begins')
  and not exists (select 1 from media_item where tmdb_id = 272 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Batman Begins') and year like '2005%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'minority-report',
  'movie',
  'Minority Report',
  '2002',
  'https://en.wikipedia.org/wiki/Minority_Report_(film)',
  180,
  'movie',
  'A Precrime cop who arrests people for murders they have not committed yet is accused of a future murder.',
  '/qtgFcnwh9dAFLocsDk2ySDVS8UF.jpg',
  0,
  null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:20:14"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'minority-report')
  and not exists (select 1 from media_item where tmdb_id = 180 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Minority Report') and year like '2002%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'back-to-the-future',
  'movie',
  'Back to the Future',
  '1985',
  'https://en.wikipedia.org/wiki/Back_to_the_Future',
  105,
  'movie',
  'Marty McFly is sent from 1985 back to 1955 and has to put his parents'' first meeting back on track.',
  '/vN5B5WgYscRGcQpVhHl6p9DDTP0.jpg',
  0,
  null,
  '[{"slug":"highway-to-the-dangerzone","title":"Highway to the Dangerzone","timestamp":"01:40:36"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'back-to-the-future')
  and not exists (select 1 from media_item where tmdb_id = 105 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Back to the Future') and year like '1985%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-day-the-earth-stood-still',
  'movie',
  'The Day the Earth Stood Still',
  '1951',
  'https://en.wikipedia.org/wiki/The_Day_the_Earth_Stood_Still',
  828,
  'movie',
  'An alien and a robot land after World War II and warn humanity to choose peace.',
  '/eslDNzf0LF1m9GsgUXlmyfTcC6Y.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:00:34"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-day-the-earth-stood-still')
  and not exists (select 1 from media_item where tmdb_id = 828 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Day the Earth Stood Still') and year like '1951%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-six-million-dollar-man',
  'tv',
  'The Six Million Dollar Man',
  '1974–1978',
  'https://en.wikipedia.org/wiki/The_Six_Million_Dollar_Man',
  1663,
  'tv',
  'Astronaut Steve Austin is rebuilt with bionic limbs and works as a secret agent.',
  '/5pd6DayQgZxK9lQHdZZYZuXyaZ2.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:15:23"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-six-million-dollar-man')
  and not exists (select 1 from media_item where tmdb_id = 1663 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Six Million Dollar Man') and year like '1974%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-witcher',
  'tv',
  'The Witcher',
  '2019–',
  'https://en.wikipedia.org/wiki/The_Witcher_(TV_series)',
  71912,
  'tv',
  'Monster hunter Geralt of Rivia travels a world where people are often worse than the beasts.',
  '/AoGsDM02UVt0npBA8OvpDcZbaMi.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"02:09:35"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'the-witcher')
  and not exists (select 1 from media_item where tmdb_id = 71912 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Witcher') and year like '2019%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'seinfeld',
  'tv',
  'Seinfeld',
  '1989–1998',
  'https://en.wikipedia.org/wiki/Seinfeld',
  1400,
  'tv',
  'A comedian and his three friends deal with the small disasters of life in New York.',
  '/aCw8ONfyz3AhngVQa1E2Ss4KSUQ.jpg',
  0,
  null,
  '[{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch","timestamp":"00:15:25"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'seinfeld')
  and not exists (select 1 from media_item where tmdb_id = 1400 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Seinfeld') and year like '1989%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'knight-rider',
  'tv',
  'Knight Rider',
  '1982–1986',
  'https://en.wikipedia.org/wiki/Knight_Rider_(1982_TV_series)',
  2384,
  'tv',
  'Michael Knight and the computerized car KITT take on criminals.',
  '/t57NXzTrwp5rnPXiaX4BThrDxt1.jpg',
  0,
  null,
  '[{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad","timestamp":"00:17:31"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'knight-rider')
  and not exists (select 1 from media_item where tmdb_id = 2384 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Knight Rider') and year like '1982%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'baywatch',
  'tv',
  'Baywatch',
  '1989–2001',
  'https://en.wikipedia.org/wiki/Baywatch',
  4386,
  'tv',
  'Los Angeles County lifeguards patrol the beaches of Los Angeles.',
  '/34t8WxHn1OcIVpcTxmjYmjX9tE4.jpg',
  0,
  null,
  '[{"slug":"heartburn-hardware-and-the-nuclear-triad","title":"Heartburn, Hardware, and the Nuclear Triad","timestamp":"00:17:31"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'baywatch')
  and not exists (select 1 from media_item where tmdb_id = 4386 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Baywatch') and year like '1989%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'law-and-order',
  'tv',
  'Law & Order',
  '1990–',
  'https://en.wikipedia.org/wiki/Law_%26_Order',
  549,
  'tv',
  'Police investigate a crime, then the district attorney''s office takes the case to court.',
  '/hmd2tEtjolLWpNLCTvXS2PO5VCi.jpg',
  0,
  null,
  '[{"slug":"spacebat-gets-its-groove","title":"SpaceBat gets its Groove","timestamp":"00:33:42"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'law-and-order')
  and not exists (select 1 from media_item where tmdb_id = 549 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Law & Order') and year like '1990%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'star-trek-the-next-generation',
  'tv',
  'Star Trek: The Next Generation',
  '1987–1994',
  'https://en.wikipedia.org/wiki/Star_Trek:_The_Next_Generation',
  655,
  'tv',
  'Captain Jean-Luc Picard and the crew of the Enterprise-D explore the galaxy.',
  '/vkLzXddgUKH5VcpnYiRzpJFrZhz.jpg',
  0,
  null,
  '[{"slug":"einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die","title":"Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die","timestamp":"00:02:05"},{"slug":"nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch","title":"Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch"}]',
  0,
  1762041600000,
  1762041600000
where not exists (select 1 from media_seed where id = 3)
  and not exists (select 1 from media_item where id = 'star-trek-the-next-generation')
  and not exists (select 1 from media_item where tmdb_id = 655 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Star Trek: The Next Generation') and year like '1987%'
  );

insert into media_seed (id, note)
select 3, 'rescan-2026-11-01'
where not exists (select 1 from media_seed where id = 3);

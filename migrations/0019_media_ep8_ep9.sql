-- Episode 8 and 9 titles Daniel approved on 2026-11-26. Ratings stay as they are.
-- New titles are inserted once. A title already stored, matched by id, TMDB id, or title,
-- is left in place and only gains an episode reference.
-- media_seed id 5 is the once-only marker. Deleting one of these titles does not remove
-- the marker, so a later boot does not insert that title again.
-- Episode references are appended only when that slug is not already stored, so a retry
-- after a partial apply does not add the same mention twice.
-- Episode 6 and 7 titles from migration 0016 are already stored and only receive an
-- Episode 9 link where the 11-26 batch called for one.

-- New titles.

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'superman-returns',
  'movie',
  'Superman Returns',
  '2006',
  'https://en.wikipedia.org/wiki/Superman_Returns',
  1452,
  'movie',
  'Superman returns to discover his 5-year absence has allowed Lex Luthor to walk free, and that those he was closest to felt abandoned and have moved on. Luthor plots his ultimate revenge that could see millions killed and change the face of the planet forever, as well as ridding himself of the Man of Steel.',
  '/385XwTQZDpRX2d3kxtnpiLrjBXw.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'superman-returns')
  and not exists (select 1 from media_item where tmdb_id = 1452 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Superman Returns')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'lois-clark-the-new-adventures-of-superman',
  'tv',
  'Lois & Clark: The New Adventures of Superman',
  '1993–1997',
  'https://en.wikipedia.org/wiki/Lois_%26_Clark:_The_New_Adventures_of_Superman',
  4515,
  'tv',
  'A much more lavish version of the popular Superman television series which had first aired forty years earlier, Lois & Clark focused more on the Man of Steel''s early adult years in Metropolis. With the unknowing help of Lois Lane, Clark Kent created Superman there in Metropolis after finding work at the world-famous Daily Planet newspaper, where he meets fellow reporter Lois Lane.',
  '/veNiZIiBsSWSAfVcJzudcuD7N0e.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'lois-clark-the-new-adventures-of-superman')
  and not exists (select 1 from media_item where tmdb_id = 4515 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Lois & Clark: The New Adventures of Superman')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'smallville',
  'tv',
  'Smallville',
  '2001–2011',
  'https://en.wikipedia.org/wiki/Smallville',
  4604,
  'tv',
  'The origins of the world''s greatest hero-from Krypton refugee Kal-el''s arrival on Earth through his tumultuous teen years to Clark Kent''s final steps toward embracing his destiny as the Man of Steel.',
  '/pUhJGETy2sec4vEkiqJ9eGeIywc.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'smallville')
  and not exists (select 1 from media_item where tmdb_id = 4604 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Smallville')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'superman-lois',
  'tv',
  'Superman & Lois',
  '2021–2024',
  'https://en.wikipedia.org/wiki/Superman_%26_Lois',
  95057,
  'tv',
  'After years of facing megalomaniacal supervillains, monsters wreaking havoc on Metropolis, and alien invaders intent on wiping out the human race, The Man of Steel aka Clark Kent and Lois Lane come face to face with one of their greatest challenges ever: dealing with all the stress, pressures and complexities that come with being working parents in today''s society.',
  '/vlv1gn98GqMnKHLSh0dNciqGfBl.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'superman-lois')
  and not exists (select 1 from media_item where tmdb_id = 95057 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Superman & Lois')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'krypton',
  'tv',
  'Krypton',
  '2018–2019',
  'https://en.wikipedia.org/wiki/Krypton_(TV_series)',
  71340,
  'tv',
  'Set two generations before the destruction of the legendary Man of Steel''s home planet, Krypton follows Superman''s grandfather - whose House of El was ostracized and shamed - as he fights to redeem his family''s honor and save his beloved world from chaos.',
  '/kMMWb4zIZKBnO3lOpVBXCL1BeNI.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'krypton')
  and not exists (select 1 from media_item where tmdb_id = 71340 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Krypton')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'arrow',
  'tv',
  'Arrow',
  '2012–2020',
  'https://en.wikipedia.org/wiki/Arrow_(TV_series)',
  1412,
  'tv',
  'Spoiled billionaire playboy Oliver Queen is missing and presumed dead when his yacht is lost at sea. He returns five years later a changed man, determined to clean up the city as a hooded vigilante armed with a bow.',
  '/u8ZHFj1jC384JEkTt3vNg1DfWEb.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'arrow')
  and not exists (select 1 from media_item where tmdb_id = 1412 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = 'arrow' and kind = 'tv' and year like '2012%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-big-bang-theory',
  'tv',
  'The Big Bang Theory',
  '2007–2019',
  'https://en.wikipedia.org/wiki/The_Big_Bang_Theory',
  1418,
  'tv',
  'Physicists Leonard and Sheldon find their nerd-centric social circle with pals Howard and Raj expanding when aspiring actress Penny moves in next door.',
  '/euKFiO5M125rpngFRBbSW83beeI.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-big-bang-theory')
  and not exists (select 1 from media_item where tmdb_id = 1418 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Big Bang Theory')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'firefly',
  'tv',
  'Firefly',
  '2002–2003',
  'https://en.wikipedia.org/wiki/Firefly_(TV_series)',
  1437,
  'tv',
  'In the year 2517, the universe is a vast frontier where lawlessness reigns and adventure awaits! Join Captain Malcolm Reynolds and his ragtag crew aboard the spaceship Serenity as they navigate the fringes of society, battling the oppressive Alliance and facing off against ruthless bounty hunters.',
  '/vZcKsy4sGAvWMVqLluwYuoi11Kj.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'firefly')
  and not exists (select 1 from media_item where tmdb_id = 1437 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Firefly')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'justice-league',
  'movie',
  'Justice League',
  '2017',
  'https://en.wikipedia.org/wiki/Justice_League_(film)',
  141052,
  'movie',
  'Fuelled by his restored faith in humanity and inspired by Superman''s selfless act, Bruce Wayne and Diana Prince assemble a team of metahumans consisting of Barry Allen, Arthur Curry and Victor Stone to face the catastrophic threat of Steppenwolf and the Parademons who are on the hunt for three Mother Boxes on Earth.',
  '/eifGNCSDuxJeS1loAXil5bIGgvC.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'justice-league')
  and not exists (select 1 from media_item where tmdb_id = 141052 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = 'justice league' and kind = 'movie' and year like '2017%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'batman-v-superman-dawn-of-justice',
  'movie',
  'Batman v Superman: Dawn of Justice',
  '2016',
  'https://en.wikipedia.org/wiki/Batman_v_Superman:_Dawn_of_Justice',
  209112,
  'movie',
  'Fearing the actions of a god-like Super Hero left unchecked, Gotham City''s own formidable, forceful vigilante takes on Metropolis''s most revered, modern-day savior, while the world wrestles with what sort of hero it really needs. And with Batman and Superman at war with one another, a new threat quickly arises, putting mankind in greater danger than it''s ever known before.',
  '/5UsK3grJvtQrtzEgqNlDljJW96w.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'batman-v-superman-dawn-of-justice')
  and not exists (select 1 from media_item where tmdb_id = 209112 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Batman v Superman: Dawn of Justice')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-batman',
  'movie',
  'The Batman',
  '2022',
  'https://en.wikipedia.org/wiki/The_Batman_(film)',
  414906,
  'movie',
  'In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.',
  '/74xTEgt7R36Fpooo50r9T25onhq.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"},{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-batman')
  and not exists (select 1 from media_item where tmdb_id = 414906 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = 'the batman' and kind = 'movie' and year like '2022%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'casino-royale',
  'movie',
  'Casino Royale',
  '2006',
  'https://en.wikipedia.org/wiki/Casino_Royale_(2006_film)',
  36557,
  'movie',
  'Le Chiffre, a banker to the world''s terrorists, is scheduled to participate in a high-stakes poker game in Montenegro, where he intends to use his winnings to establish his financial grip on the terrorist market. M sends Bond-on his maiden mission as a 00 Agent-to attend this game and prevent Le Chiffre from winning. With the help of Vesper Lynd and Felix Leiter, Bond enters the most important poker game in his already dangerous career.',
  '/lMrxYKKhd4lqRzwUHAy5gcx9PSO.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'casino-royale')
  and not exists (select 1 from media_item where tmdb_id = 36557 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = 'casino royale' and kind = 'movie' and year like '2006%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'on-her-majesty-s-secret-service',
  'movie',
  'On Her Majesty''s Secret Service',
  '1969',
  'https://en.wikipedia.org/wiki/On_Her_Majesty%27s_Secret_Service_(film)',
  668,
  'movie',
  'With the help of Marc-Ange Draco, head of the Unione Corse crime syndicate, and Draco''s troubled daughter Tracy, James Bond tracks his archnemesis, Ernst Stravro Blofeld, to a mountaintop retreat in the Swiss Alps, where he is training an army of beautiful, lethal women.',
  '/yVzJLLhBwuWJBR9BYEMurShu2WT.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'on-her-majesty-s-secret-service')
  and not exists (select 1 from media_item where tmdb_id = 668 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('On Her Majesty''s Secret Service')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-avengers-1961',
  'tv',
  'The Avengers',
  '1961–1969',
  'https://en.wikipedia.org/wiki/The_Avengers_(TV_series)',
  2473,
  'tv',
  'A quirky spy show of the adventures of eccentrically suave British Agent John Steed and his predominantly female partners. Jonathan Steed - an urbane, proper gentleman spy - teams with various assistants throughout the series'' run, including Dr. David Keel, Cathy Gale, Emma Peel and Tara King, to repeatedly save the world from diabolical schemes plotted by equally diabolical evil-doers (among them robots and man-eating monsters).',
  '/7D2DosFWqmNc0vfZJPqwY5uIvsR.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-avengers-1961')
  and not exists (select 1 from media_item where tmdb_id = 2473 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = 'the avengers' and kind = 'tv' and year like '1961%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'avengers-age-of-ultron',
  'movie',
  'Avengers: Age of Ultron',
  '2015',
  'https://en.wikipedia.org/wiki/Avengers:_Age_of_Ultron',
  99861,
  'movie',
  'When Tony Stark tries to jumpstart a dormant peacekeeping program, things go awry and Earth''s Mightiest Heroes are put to the ultimate test as the fate of the planet hangs in the balance. As the villainous Ultron emerges, it is up to The Avengers to stop him from enacting his terrible plans, and soon uneasy alliances and unexpected action pave the way for an epic and unique global adventure.',
  '/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'avengers-age-of-ultron')
  and not exists (select 1 from media_item where tmdb_id = 99861 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Avengers: Age of Ultron')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'rogue-one-a-star-wars-story',
  'movie',
  'Rogue One: A Star Wars Story',
  '2016',
  'https://en.wikipedia.org/wiki/Rogue_One',
  330459,
  'movie',
  'A rogue band of resistance fighters unite for a mission to steal the Death Star plans and bring a new hope to the galaxy.',
  '/1zoZ0e2q34FUnT7xuEnGazBFrbL.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'rogue-one-a-star-wars-story')
  and not exists (select 1 from media_item where tmdb_id = 330459 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Rogue One: A Star Wars Story')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'falling-down',
  'movie',
  'Falling Down',
  '1993',
  'https://en.wikipedia.org/wiki/Falling_Down',
  37094,
  'movie',
  'An ordinary man frustrated with the various flaws he sees in society begins to psychotically and violently lash out against them.',
  '/7ujqyF96Zg3rfrsh9M0cEF0Yzqj.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'falling-down')
  and not exists (select 1 from media_item where tmdb_id = 37094 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Falling Down')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'kingpin',
  'movie',
  'Kingpin',
  '1996',
  'https://en.wikipedia.org/wiki/Kingpin_(1996_film)',
  11543,
  'movie',
  'After bowler Roy Munson swindles the wrong crowd and is left with a hook for a hand, he settles into impoverished obscurity. That is, until he uncovers the next big thing: an Amish kid named Ishmael. So, the corrupt and the hopelessly naive hit the circuit intent on settling an old score with Big Ern.',
  '/lVpejjxzBujSjLpxQ7hGe1s0wP2.jpg',
  0,
  null,
  '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'kingpin')
  and not exists (select 1 from media_item where tmdb_id = 11543 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = 'kingpin' and kind = 'movie' and year like '1996%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-great-santini',
  'movie',
  'The Great Santini',
  '1979',
  'https://en.wikipedia.org/wiki/The_Great_Santini',
  21887,
  'movie',
  'As he approaches manhood, Ben Meechum struggles to win the approval of his demanding alpha male father, an aggressively competitive, but frustrated marine pilot.',
  '/xvoHFQlSAq0696rvONsEAWj1fcm.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-great-santini')
  and not exists (select 1 from media_item where tmdb_id = 21887 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Great Santini')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-punisher',
  'tv',
  'The Punisher',
  '2017–2019',
  'https://en.wikipedia.org/wiki/The_Punisher_(TV_series)',
  67178,
  'tv',
  'A former Marine out to punish the criminals responsible for his family''s murder finds himself ensnared in a military conspiracy.',
  '/tM6xqRKXoloH9UchaJEyyRE9O1w.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-punisher')
  and not exists (select 1 from media_item where tmdb_id = 67178 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = 'the punisher' and kind = 'tv' and year like '2017%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'logan',
  'movie',
  'Logan',
  '2017',
  'https://en.wikipedia.org/wiki/Logan_(film)',
  263115,
  'movie',
  'In the near future, a weary Logan cares for an ailing Professor X in a hideout on the Mexican border. But Logan''s attempts to hide from the world and his legacy are upended when a young mutant arrives, pursued by dark forces.',
  '/fnbjcRDYn6YviCcePDnGdyAkYsB.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'logan')
  and not exists (select 1 from media_item where tmdb_id = 263115 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = 'logan' and kind = 'movie' and year like '2017%'
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'deadpool-wolverine',
  'movie',
  'Deadpool & Wolverine',
  '2024',
  'https://en.wikipedia.org/wiki/Deadpool_%26_Wolverine',
  533535,
  'movie',
  'A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary, Deadpool, behind him. But when his homeworld faces an existential threat, Wade must reluctantly suit-up again with an even more reluctant Wolverine.',
  '/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'deadpool-wolverine')
  and not exists (select 1 from media_item where tmdb_id = 533535 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Deadpool & Wolverine')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-matrix',
  'movie',
  'The Matrix',
  '1999',
  'https://en.wikipedia.org/wiki/The_Matrix',
  603,
  'movie',
  'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
  '/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-matrix')
  and not exists (select 1 from media_item where tmdb_id = 603 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Matrix')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'colossus-the-forbin-project',
  'movie',
  'Colossus: The Forbin Project',
  '1970',
  'https://en.wikipedia.org/wiki/Colossus:_The_Forbin_Project',
  14801,
  'movie',
  'The U.S. has handed over control of its nuclear defense system to the Colossus supercomputer designed by scientist Dr. Charles Forbin. It soon becomes clear, that the now-sentient Colossus is far more intelligent than its creator realized-with the fate of the world hanging in the balance.',
  '/kmVDlTzERxSvBrqtQurjKf1zEy1.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'colossus-the-forbin-project')
  and not exists (select 1 from media_item where tmdb_id = 14801 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Colossus: The Forbin Project')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-lathe-of-heaven',
  'movie',
  'The Lathe of Heaven',
  '1980',
  'https://en.wikipedia.org/wiki/The_Lathe_of_Heaven_(film)',
  27864,
  'movie',
  'George Orr, a man whose dreams can change waking reality, tries to suppress this unpredictable gift with drugs. Dr. Haber, an assigned psychiatrist, discovers the gift to be real and hypnotically induces Mr. Orr to change reality for the benefit of mankind --- with bizarre and frightening results.',
  '/xQwNDyCXROg7LalX9f7mqTrCFfg.jpg',
  0,
  null,
  '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]',
  0,
  1795651200000,
  1795651200000
where not exists (select 1 from media_seed where id = 5)
  and not exists (select 1 from media_item where id = 'the-lathe-of-heaven')
  and not exists (select 1 from media_item where tmdb_id = 27864 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Lathe of Heaven')
  );

update media_item
set episodes = case
  when trim(episodes) = '[]' then '[{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}]'
  else substr(trim(episodes), 1, length(trim(episodes)) - 1) || ',' || '{"slug":"one-light-day-away-space-superheroes-and-ant-ipo-ai-drama","title":"One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama"}' || ']'
end
where not exists (select 1 from media_seed where id = 5)
  and episodes not like '%one-light-day-away-space-superheroes-and-ant-ipo-ai-drama%'
  and substr(trim(episodes), length(trim(episodes)), 1) = ']'
  and (
    id in ('superman', 'zack-snyder-s-justice-league', 'the-batman-part-ii', 'kraven-the-hunter', 'spider-man-brand-new-day', 'visionquest', 'loki', 'andor', 'superman-returns', 'lois-clark-the-new-adventures-of-superman', 'smallville', 'superman-lois', 'krypton', 'arrow', 'the-big-bang-theory', 'firefly', 'justice-league', 'batman-v-superman-dawn-of-justice', 'the-batman', 'casino-royale', 'on-her-majesty-s-secret-service', 'the-avengers-1961', 'avengers-age-of-ultron', 'rogue-one-a-star-wars-story', 'falling-down', 'kingpin')
    or (lower(title) = 'superman' and year like '2025%')
    or (lower(title) = 'zack snyder''s justice league')
    or lower(title) = 'the batman: part ii'
    or (lower(title) = 'kraven the hunter')
    or lower(title) = 'spider-man: brand new day'
    or (lower(title) = 'visionquest' and kind = 'tv')
    or (lower(title) = 'loki' and kind = 'tv')
    or (lower(title) = 'andor' and kind = 'tv')
    or (lower(title) = 'the batman' and year like '2022%')
    or (lower(title) = 'the avengers' and kind = 'tv' and year like '1961%')
    or (lower(title) = 'justice league' and year like '2017%')
    or (lower(title) = 'on her majesty''s secret service' and year like '1969%')
    or (lower(title) = 'lois & clark: the new adventures of superman')
    or (lower(title) = 'superman & lois')
    or (lower(title) = 'rogue one: a star wars story')
    or (lower(title) = 'batman v superman: dawn of justice')
    or (lower(title) = 'avengers: age of ultron')
    or (tmdb_id = 1452 and tmdb_type = 'movie')
    or (tmdb_id = 4515 and tmdb_type = 'tv')
    or (tmdb_id = 4604 and tmdb_type = 'tv')
    or (tmdb_id = 95057 and tmdb_type = 'tv')
    or (tmdb_id = 71340 and tmdb_type = 'tv')
    or (tmdb_id = 1412 and tmdb_type = 'tv')
    or (tmdb_id = 1418 and tmdb_type = 'tv')
    or (tmdb_id = 1437 and tmdb_type = 'tv')
    or (tmdb_id = 141052 and tmdb_type = 'movie')
    or (tmdb_id = 209112 and tmdb_type = 'movie')
    or (tmdb_id = 414906 and tmdb_type = 'movie')
    or (tmdb_id = 36557 and tmdb_type = 'movie')
    or (tmdb_id = 668 and tmdb_type = 'movie')
    or (tmdb_id = 2473 and tmdb_type = 'tv')
    or (tmdb_id = 99861 and tmdb_type = 'movie')
    or (tmdb_id = 330459 and tmdb_type = 'movie')
    or (tmdb_id = 37094 and tmdb_type = 'movie')
    or (tmdb_id = 11543 and tmdb_type = 'movie')
    or (tmdb_id = 1061474 and tmdb_type = 'movie')
    or (tmdb_id = 791373 and tmdb_type = 'movie')
    or (tmdb_id = 806704 and tmdb_type = 'movie')
    or (tmdb_id = 539972 and tmdb_type = 'movie')
    or lower(title) in ('superman returns', 'smallville', 'krypton', 'arrow', 'the big bang theory', 'firefly', 'casino royale', 'falling down', 'kingpin')
  );

update media_item
set episodes = case
  when trim(episodes) = '[]' then '[{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}]'
  else substr(trim(episodes), 1, length(trim(episodes)) - 1) || ',' || '{"slug":"dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes","title":"Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes"}' || ']'
end
where not exists (select 1 from media_seed where id = 5)
  and episodes not like '%dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes%'
  and substr(trim(episodes), length(trim(episodes)), 1) = ']'
  and (
    id in ('spider-man-brand-new-day', 'avengers-doomsday', 'invincible', 'fallout', 'batman-begins', 'the-brave-and-the-bold', 'the-batman-part-ii', 'man-of-tomorrow', '2001-a-space-odyssey', 'the-batman', 'the-great-santini', 'the-punisher', 'logan', 'deadpool-wolverine', 'the-matrix', 'colossus-the-forbin-project', 'the-lathe-of-heaven')
    or lower(title) = 'spider-man: brand new day'
    or lower(title) = 'avengers: doomsday'
    or (lower(title) = 'invincible' and kind = 'tv')
    or (lower(title) = 'fallout' and kind = 'tv')
    or (lower(title) = 'batman begins' and year like '2005%')
    or lower(title) = 'the brave and the bold'
    or lower(title) = 'the batman: part ii'
    or lower(title) = 'man of tomorrow'
    or lower(title) in ('2001: a space odyssey', '2001 a space odyssey')
    or (lower(title) = 'the batman' and year like '2022%')
    or (lower(title) = 'the punisher' and kind = 'tv' and year like '2017%')
    or (lower(title) = 'deadpool & wolverine')
    or lower(title) = 'colossus: the forbin project'
    or lower(title) = 'the lathe of heaven'
    or lower(title) = 'the great santini'
    or (lower(title) = 'logan' and year like '2017%')
    or (lower(title) = 'the matrix' and year like '1999%')
    or (tmdb_id = 414906 and tmdb_type = 'movie')
    or (tmdb_id = 21887 and tmdb_type = 'movie')
    or (tmdb_id = 67178 and tmdb_type = 'tv')
    or (tmdb_id = 263115 and tmdb_type = 'movie')
    or (tmdb_id = 533535 and tmdb_type = 'movie')
    or (tmdb_id = 603 and tmdb_type = 'movie')
    or (tmdb_id = 14801 and tmdb_type = 'movie')
    or (tmdb_id = 27864 and tmdb_type = 'movie')
    or (tmdb_id = 272 and tmdb_type = 'movie')
    or (tmdb_id = 1081004 and tmdb_type = 'movie')
    or (tmdb_id = 806704 and tmdb_type = 'movie')
    or (tmdb_id = 1523140 and tmdb_type = 'movie')
    or (tmdb_id = 62 and tmdb_type = 'movie')
    or (tmdb_id = 95557 and tmdb_type = 'tv')
  );

insert into media_seed (id, note)
select 5, 'episodes-8-9'
where not exists (select 1 from media_seed where id = 5);

-- Episode 6 and 7 titles Daniel approved on 2026-11-13. Ratings stay as they are.
-- New titles are inserted once. A title already stored, matched by id, TMDB id, or title,
-- is left in place and only gains an episode reference.
-- media_seed id 4 is the once-only marker. Deleting one of these titles does not remove
-- the marker, so a later boot does not insert that title again.
-- Episode references are appended only when that slug is not already stored, so a retry
-- after a partial apply does not add the same mention twice.

-- New titles.

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'green-book',
  'movie',
  'Green Book',
  '2018',
  'https://en.wikipedia.org/wiki/Green_Book_(film)',
  490132,
  'movie',
  'Tony Lip, a bouncer in 1962, is hired to drive pianist Don Shirley on a tour through the Deep South in the days when African Americans, forced to find alternate accommodations and services due to segregation laws below the Mason-Dixon Line, relied on a guide called The Negro Motorist Green Book.',
  '/7BsvSuDQuoqhWmU2fL7W2GOcZHU.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"},{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'green-book')
  and not exists (select 1 from media_item where tmdb_id = 490132 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Green Book')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'clarkson-s-farm',
  'tv',
  'Clarkson''s Farm',
  '2021–',
  'https://en.wikipedia.org/wiki/Clarkson%27s_Farm',
  117648,
  'tv',
  'Follow Jeremy Clarkson as he embarks on his latest adventure, farming. The man who on several occasions claims to be allergic to manual labour takes on the most manually labour intensive job there is. What could possibly go wrong?',
  '/toVhyqMT3ICfahE7Ad8obJvZHpX.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'clarkson-s-farm')
  and not exists (select 1 from media_item where tmdb_id = 117648 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Clarkson''s Farm')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-treet',
  'tv',
  'The $treet',
  '2000',
  'https://en.wikipedia.org/wiki/The_Street_(2000_TV_series)',
  1616,
  'tv',
  'The $treet is an American television drama series about a small brokerage house called Belmont Stevens located in New York and the lives of its employees. Freddie Sacker was one of the most notable characters played by Rick Hoffman.',
  '/tHdPAxHVU9I0bRJpINPz5x3o57j.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'the-treet')
  and not exists (select 1 from media_item where tmdb_id = 1616 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The $treet')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'suits',
  'tv',
  'Suits',
  '2011–2019',
  'https://en.wikipedia.org/wiki/Suits_(American_TV_series)',
  37680,
  'tv',
  'While running from a drug deal gone bad, Mike Ross, a brilliant young college-dropout, slips into a job interview with one of New York City''s best legal closers, Harvey Specter. Tired of cookie-cutter law school grads, Harvey takes a gamble by hiring Mike on the spot after he recognizes his raw talent and photographic memory.',
  '/vQiryp6LioFxQThywxbC6TuoDjy.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'suits')
  and not exists (select 1 from media_item where tmdb_id = 37680 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Suits')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-sopranos',
  'tv',
  'The Sopranos',
  '1999–2007',
  'https://en.wikipedia.org/wiki/The_Sopranos',
  1398,
  'tv',
  'The story of New Jersey-based Italian-American mobster Tony Soprano and the difficulties he faces as he tries to balance the conflicting requirements of his home life and the criminal organization he heads. Those difficulties are often highlighted through his ongoing professional relationship with psychiatrist Jennifer Melfi. The show features Tony''s family members and Mafia associates in prominent roles and story arcs, most notably his wife Carmela and his cousin and protégé Christopher Moltisanti.',
  '/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'the-sopranos')
  and not exists (select 1 from media_item where tmdb_id = 1398 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Sopranos')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-passion-of-the-christ',
  'movie',
  'The Passion of the Christ',
  '2004',
  'https://en.wikipedia.org/wiki/The_Passion_of_the_Christ',
  615,
  'movie',
  'A graphic portrayal of the last twelve hours of Jesus of Nazareth''s life.',
  '/rBM5o2HpmCfDejuIPybI09tkY3V.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'the-passion-of-the-christ')
  and not exists (select 1 from media_item where tmdb_id = 615 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Passion of the Christ')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'sound-of-freedom',
  'movie',
  'Sound of Freedom',
  '2023',
  'https://en.wikipedia.org/wiki/Sound_of_Freedom',
  678512,
  'movie',
  'The story of Tim Ballard, a former US government agent, who quits his job in order to devote his life to rescuing children from global sex traffickers.',
  '/qA5kPYZA7FkVvqcEfJRoOy4kpHg.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'sound-of-freedom')
  and not exists (select 1 from media_item where tmdb_id = 678512 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Sound of Freedom')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'supergirl',
  'movie',
  'Supergirl',
  '2026',
  'https://en.wikipedia.org/wiki/Supergirl_(2026_film)',
  1081003,
  'movie',
  'When an unexpected and ruthless adversary strikes too close to home, Kara Zor-El, aka Supergirl, reluctantly joins forces with an unlikely companion on an epic, interstellar journey of vengeance and justice.',
  '/uhzRnTW4DM13UQBvZP3eVNzQTuz.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'supergirl')
  and not exists (select 1 from media_item where tmdb_id = 1081003 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Supergirl')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-flash',
  'movie',
  'The Flash',
  '2023',
  'https://en.wikipedia.org/wiki/The_Flash_(film)',
  298618,
  'movie',
  'When his attempt to save his family inadvertently alters the future, Barry Allen becomes trapped in a reality in which General Zod has returned and there are no Super Heroes to turn to. In order to save the world that he is in and return to the future that he knows, Barry''s only hope is to race for his life. But will making the ultimate sacrifice be enough to reset the universe?',
  '/rktDFPbfHfUbArZ6OOOKsXcv0Bm.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'the-flash')
  and not exists (select 1 from media_item where tmdb_id = 298618 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Flash')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'invincible',
  'tv',
  'Invincible',
  '2021–',
  'https://en.wikipedia.org/wiki/Invincible_(TV_series)',
  95557,
  'tv',
  'Mark Grayson is a normal teenager except for the fact that his father is the most powerful superhero on the planet. Shortly after his seventeenth birthday, Mark begins to develop powers of his own and enters into his father''s tutelage.',
  '/4tblBrslcKSifMVZ3TmtT2ukMor.jpg',
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'invincible')
  and not exists (select 1 from media_item where tmdb_id = 95557 and tmdb_type = 'tv')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Invincible')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-brave-and-the-bold',
  'movie',
  'The Brave and the Bold',
  'upcoming',
  null,
  1081004,
  'movie',
  'The story of Damian Wayne, who was raised as a little murderer and assassin, and Batman''s son that he didn''t know existed for the first eight to ten years of his life.',
  null,
  0,
  null,
  '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'the-brave-and-the-bold')
  and not exists (select 1 from media_item where tmdb_id = 1081004 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Brave and the Bold')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'man-of-tomorrow',
  'movie',
  'Man of Tomorrow',
  '2027 (upcoming)',
  'https://en.wikipedia.org/wiki/Man_of_Tomorrow_(film)',
  1523140,
  'movie',
  'Superman and Lex Luthor find themselves forced to work together—to a certain degree—against a much, much bigger threat when Brainiac sets his sights on Earth.',
  '/tYLgfKk3cEk7LskgxWyW37Nty01.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'man-of-tomorrow')
  and not exists (select 1 from media_item where tmdb_id = 1523140 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Man of Tomorrow')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'zack-snyder-s-justice-league',
  'movie',
  'Zack Snyder''s Justice League',
  '2021',
  'https://en.wikipedia.org/wiki/Zack_Snyder%27s_Justice_League',
  791373,
  'movie',
  'Determined to ensure Superman''s ultimate sacrifice was not in vain, Bruce Wayne aligns forces with Diana Prince with plans to recruit a team of metahumans to protect the world from an approaching threat of catastrophic proportions.',
  '/tnAuB8q5vv7Ax9UAEje5Xi4BXik.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'zack-snyder-s-justice-league')
  and not exists (select 1 from media_item where tmdb_id = 791373 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Zack Snyder''s Justice League')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'godzilla-minus-zero',
  'movie',
  'Godzilla Minus Zero',
  '2026',
  'https://en.wikipedia.org/wiki/Godzilla_Minus_Zero',
  1381071,
  'movie',
  'War reduced Japan to zero, and Godzilla plunged it into minus. Two years have passed since then, and the country has faced agonizing struggles to achieve recovery and finally reclaim its daily life. Just as humanity managed to cling to a hard-won peace, a new threat strikes, crushing hope in an instant. There is no third time. Everything ends here.',
  '/hSmIJluOJmTWvJs4d7kHRxjc8s8.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'godzilla-minus-zero')
  and not exists (select 1 from media_item where tmdb_id = 1381071 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Godzilla Minus Zero')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'the-odyssey',
  'movie',
  'The Odyssey',
  '2026',
  'https://en.wikipedia.org/wiki/The_Odyssey_(2026_film)',
  1368337,
  'movie',
  'Odysseus, the legendary King of Ithaca, embarks on a long and perilous journey home following the Trojan War. Throughout his voyage, he is forced to confront the whims of gods, mythological monsters, and trials that stretch both his cunning and his humanity to the breaking point.',
  '/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'the-odyssey')
  and not exists (select 1 from media_item where tmdb_id = 1368337 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('The Odyssey')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'wargames',
  'movie',
  'WarGames',
  '1983',
  'https://en.wikipedia.org/wiki/WarGames',
  860,
  'movie',
  'High school student David Lightman has a talent for hacking. But while trying to hack into a computer system to play unreleased video games, he unwittingly taps into the Department of Defense''s war computer and initiates a confrontation of global proportions. Together with his friend and a wizardly computer genius, David must race against time to outwit his opponent and prevent a nuclear Armageddon.',
  '/zZ1rN4LoPxKNfAp67Xl300WxVeD.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'wargames')
  and not exists (select 1 from media_item where tmdb_id = 860 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('WarGames')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'contact',
  'movie',
  'Contact',
  '1997',
  'https://en.wikipedia.org/wiki/Contact_(1997_American_film)',
  686,
  'movie',
  'A radio astronomer receives the first extraterrestrial radio signal ever picked up on Earth. As the world powers scramble to decipher the message and decide upon a course of action, she must make some difficult decisions between her beliefs, the truth, and reality.',
  '/bCpMIywuNZeWt3i5UMLEIc0VSwM.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'contact')
  and not exists (select 1 from media_item where tmdb_id = 686 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Contact')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'iron-man',
  'movie',
  'Iron Man',
  '2008',
  'https://en.wikipedia.org/wiki/Iron_Man_(2008_film)',
  1726,
  'movie',
  'After being held captive in an Afghan cave, billionaire engineer Tony Stark creates a unique weaponized suit of armor to fight evil.',
  '/78lPtwv72eTNqFW9COBYI0dWDJa.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'iron-man')
  and not exists (select 1 from media_item where tmdb_id = 1726 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Iron Man')
  );

insert into media_item (
  id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, poster_path,
  best_guess, best_guess_reason, episodes, sort_rank, created_at, updated_at
)
select
  'lone-survivor',
  'movie',
  'Lone Survivor',
  '2013',
  'https://en.wikipedia.org/wiki/Lone_Survivor',
  193756,
  'movie',
  'Four Navy SEALs on a covert mission to neutralize a high-level Taliban operative must make an impossible moral decision in the mountains of Afghanistan that leads them into an enemy ambush. As they confront unthinkable odds, the SEALs must find reserves of strength and resilience to fight to the finish.',
  '/zaBIrloyhGK7iNTZMb3f9SARsl8.jpg',
  0,
  null,
  '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]',
  0,
  1794528000000,
  1794528000000
where not exists (select 1 from media_seed where id = 4)
  and not exists (select 1 from media_item where id = 'lone-survivor')
  and not exists (select 1 from media_item where tmdb_id = 193756 and tmdb_type = 'movie')
  and not exists (
    select 1 from media_item
    where lower(title) = lower('Lone Survivor')
  );

-- Episode references for titles already on the site. Nothing else on those rows changes.

update media_item
set episodes = case
  when trim(episodes) = '[]' then '[{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}]'
  else substr(trim(episodes), 1, length(trim(episodes)) - 1) || ',' || '{"slug":"ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum","title":"AI Meltdown, Europe Cracks, Gunn to Batman''s Head, Quantum!?!"}' || ']'
end
where not exists (select 1 from media_seed where id = 4)
  and episodes not like '%ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum%'
  and substr(trim(episodes), length(trim(episodes)), 1) = ']'
  and (
    id in ('visionquest', 'loki', 'superman', 'man-of-steel', 'the-batman-part-ii')
    or (lower(title) = 'visionquest' and kind = 'tv')
    or (lower(title) = 'loki' and kind = 'tv')
    or (lower(title) = 'superman' and year like '2025%')
    or (lower(title) = 'man of steel' and year like '2013%')
    or lower(title) = 'the batman: part ii'
    or id in (
      'green-book', 'clarkson-s-farm', 'the-treet', 'suits', 'the-sopranos',
      'the-passion-of-the-christ', 'sound-of-freedom', 'supergirl', 'the-flash',
      'invincible', 'the-brave-and-the-bold'
    )
    or (tmdb_id = 490132 and tmdb_type = 'movie')
    or (tmdb_id = 117648 and tmdb_type = 'tv')
    or (tmdb_id = 1616 and tmdb_type = 'tv')
    or (tmdb_id = 37680 and tmdb_type = 'tv')
    or (tmdb_id = 1398 and tmdb_type = 'tv')
    or (tmdb_id = 615 and tmdb_type = 'movie')
    or (tmdb_id = 678512 and tmdb_type = 'movie')
    or (tmdb_id = 1081003 and tmdb_type = 'movie')
    or (tmdb_id = 298618 and tmdb_type = 'movie')
    or (tmdb_id = 95557 and tmdb_type = 'tv')
    or (tmdb_id = 1081004 and tmdb_type = 'movie')
    or lower(title) in (
      'green book', 'clarkson''s farm', 'the $treet', 'suits', 'the sopranos',
      'the passion of the christ', 'sound of freedom', 'supergirl', 'the flash',
      'invincible', 'the brave and the bold'
    )
  );

update media_item
set episodes = case
  when trim(episodes) = '[]' then '[{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}]'
  else substr(trim(episodes), 1, length(trim(episodes)) - 1) || ',' || '{"slug":"vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this","title":"Vets - The Brave and the Bold, Jensen \u0022Hung\u0022, DC Re-Loads, Tokenize \u0022This\u0022"}' || ']'
end
where not exists (select 1 from media_seed where id = 4)
  and episodes not like '%vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this%'
  and substr(trim(episodes), length(trim(episodes)), 1) = ']'
  and (
    id in (
      'visionquest', 'loki', 'superman', 'man-of-steel', 'wandavision',
      'blade-runner-2099', 'blade-runner', 'blade-runner-2049', '2001-a-space-odyssey'
    )
    or (lower(title) = 'visionquest' and kind = 'tv')
    or (lower(title) = 'loki' and kind = 'tv')
    or (lower(title) = 'wandavision' and kind = 'tv')
    or (lower(title) = 'blade runner 2099' and kind = 'tv')
    or (lower(title) = 'superman' and year like '2025%')
    or (lower(title) = 'man of steel' and year like '2013%')
    or (lower(title) = 'blade runner' and year like '1982%')
    or (lower(title) = 'blade runner 2049' and year like '2017%')
    or lower(title) in ('2001: a space odyssey', '2001 a space odyssey')
    or id in (
      'green-book', 'man-of-tomorrow', 'zack-snyder-s-justice-league', 'godzilla-minus-zero',
      'the-odyssey', 'wargames', 'contact', 'iron-man', 'lone-survivor'
    )
    or (tmdb_id = 490132 and tmdb_type = 'movie')
    or (tmdb_id = 1523140 and tmdb_type = 'movie')
    or (tmdb_id = 791373 and tmdb_type = 'movie')
    or (tmdb_id = 1381071 and tmdb_type = 'movie')
    or (tmdb_id = 1368337 and tmdb_type = 'movie')
    or (tmdb_id = 860 and tmdb_type = 'movie')
    or (tmdb_id = 686 and tmdb_type = 'movie')
    or (tmdb_id = 1726 and tmdb_type = 'movie')
    or (tmdb_id = 193756 and tmdb_type = 'movie')
    or lower(title) in (
      'green book', 'man of tomorrow', 'zack snyder''s justice league', 'godzilla minus zero',
      'the odyssey', 'wargames', 'contact', 'iron man', 'lone survivor'
    )
  );

insert into media_seed (id, note)
select 4, 'episodes-6-7'
where not exists (select 1 from media_seed where id = 4);

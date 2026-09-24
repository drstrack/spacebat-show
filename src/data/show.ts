export type EpisodeStatus = "published" | "upcoming";

export type Episode = {
  slug: string;
  code: string;
  title: string;
  teaser: string;
  description: string;
  date: string;
  dateLabel: string;
  cover: string;
  /** External listen link (Spotify, Apple, YouTube, etc.) once an episode is out. */
  listenUrl?: string;
  /** Podhome episode page, when the recording is posted. */
  pageUrl?: string;
  status: EpisodeStatus;
  topics: string[];
};

export const show = {
  name: "SpaceBat",
  tagline: "Hold on.",
  lede: "Two friends. Comics, movies, tech, politics, markets. Named, tongue in cheek, for a bat that wouldn’t let go.",
  socials: {
    danLinkedIn: "https://www.linkedin.com/in/daniel-strack",
    johnLinkedIn: "https://www.linkedin.com/in/john-mulligan-9a8188b1",
    danX: "https://x.com/danielrstrack",
  },
  /** Podhome live stream (Icecast). HTTPS — the http URL is the same mount. */
  liveStream: "https://stream.podhome.fm/the-spacebat-show",
  /** Public RSS. Finished episodes are read from here. */
  feedUrl: "https://serve.podhome.fm/rss/4d42b4ec-475a-4fc7-9470-799fd9192a60",
};

export const hosts = {
  dan: {
    first: "Daniel",
    last: "Strack",
    name: "Daniel Strack",
    short: "Dan",
    role: "Host",
    photo: "/images/dan-comic.webp",
    location: "Colts Neck, New Jersey",
    now: "COO, AMYNA Systems",
    headline: "COO, AMYNA Systems Inc.",
    xHandle: "danielrstrack",
    xName: "Daniel Robert Strack",
    xBio: "Dad | Husband | COO @AmynaSystems | @GSDistillery | @PorkRollTruck | Former @GoldmanSachs MD | Tech Geek | Wine Enthusiast | No Agenda | @NYJets | @NJDevils",
    links: [
      { label: "LinkedIn", href: show.socials.danLinkedIn },
      { label: "X", href: show.socials.danX },
    ],
    blurb:
      "Dad. Husband. Eagle Scout. A computer-science kid who found the trading floor, then kept finding new rooms. Dan co-founded the program trading desk at Spear, Leeds & Kellogg, spent sixteen years at Goldman Sachs as vice president then managing director in equities algorithmic trading, and left the Street to make things you can taste and hold — Garden State Distillery, a pork-roll shop, then cybersecurity. At the distillery he ran back office, sales, and operations. Out of that plant he built WhiskeyOS, the operating system for craft distilleries: one calm record from grain to glass — production, inventory, federal and local excise, and the sales book. Built by a distiller, for distillers, starting in New Jersey. He served as executive director at Project Veritas: the search for truth, on the record. He is COO of AMYNA Systems. On X he writes as @danielrstrack: tech geek, wine, No Agenda, Jets, Devils.",
    experience: [
      {
        title: "Chief Operating Officer",
        org: "AMYNA Systems Inc.",
        dates: "Feb 2024 – Present",
        detail:
          "IoT and OT cybersecurity. Embedded protection at the network edge.",
      },
      {
        title: "Founder",
        org: "WhiskeyOS",
        dates: "2026 – Present",
        detail:
          "The operating system for craft distilleries. Production, inventory, federal and local excise tax, CRM, and marketing — one record from grain to glass. The still stays analog. The books do not.",
      },
      {
        title: "Co-host",
        org: "SpaceBat",
        dates: "2026 – Present",
        detail: "Comics, movies, tech, politics, markets.",
      },
      {
        title: "Managing Partner",
        org: "Garden State Distillery",
        dates: "2018 – Present",
        detail:
          "Business partner. Back office, sales, and operations — the stillhouse work WhiskeyOS is built from.",
      },
      {
        title: "Managing Partner",
        org: "Johnny's Pork Roll and Coffee Too!",
        dates: "2017 – Present",
      },
      {
        title: "Chairman, Advisory Board",
        org: "RewardJet",
        dates: "2017 – Present",
      },
      {
        title: "Executive Director",
        org: "Project Veritas",
        dates: "2022 – 2023",
        detail:
          "The search for truth. Undercover journalism, primary sources, institutions on the record.",
      },
      {
        title: "Chief Operating Officer",
        org: "OneTeam Financial",
        dates: "2019 – 2021",
      },
      {
        title: "Managing Partner",
        org: "ClearSafe Labs",
        dates: "2018 – 2021",
        detail: "Hemp-CBD products.",
      },
      {
        title: "Chief Strategy Officer",
        org: "Vandham Securities",
        dates: "2017 – 2018",
      },
      {
        title: "Managing Director",
        org: "Goldman Sachs",
        dates: "2013 – 2016",
        detail:
          "Equities algorithmic trading. Business and technical teams, specialized desks, client coverage.",
      },
      {
        title: "Vice President",
        org: "Goldman Sachs",
        dates: "2002 – 2013",
        detail: "Grew the equities algorithmic trading franchise after the SLK acquisition.",
      },
      {
        title: "Sales Trader · Co-founder, Program Trading",
        org: "Spear, Leeds & Kellogg",
        dates: "1996 – 2002",
        detail:
          "Co-founded and ran the program trading desk. $80 million in revenue in 2000 — the year Goldman bought the firm.",
      },
      {
        title: "Software Development Intern",
        org: "Troster Singer",
        dates: "1993 – 1995",
      },
    ],
    education: [
      {
        school: "Boy Scouts of America",
        degree: "Eagle Scout",
        dates: "",
      },
      {
        school: "Loyola University Maryland",
        degree: "B.S. Computer Science",
        dates: "1991 – 1995",
      },
      {
        school: "Assumption University",
        degree: "Computer Science",
        dates: "1994 – 1995",
      },
    ],
    facts: [
      "Eagle Scout",
      "B.S. Computer Science, Loyola University Maryland",
      "Co-founded program trading at Spear, Leeds & Kellogg",
      "MD, Goldman Sachs — equities algorithmic trading",
      "Executive Director, Project Veritas — the search for truth",
      "Founder, WhiskeyOS — grain to glass for craft distilleries",
      "COO, AMYNA Systems · Garden State Distillery",
      "Jets. Devils. Wine. No Agenda.",
    ],
  },
  john: {
    first: "John",
    last: "Mulligan",
    name: "John Mulligan",
    short: "John",
    role: "Host",
    photo: "/images/john-comic.webp",
    location: "New York / New Jersey",
    now: "Goldman Sachs",
    headline: "Goldman Sachs",
    xHandle: "",
    xName: "",
    xBio: "",
    links: [{ label: "LinkedIn", href: show.socials.johnLinkedIn }],
    blurb:
      "John is Dan’s longtime friend and former colleague. LinkedIn lists him at Goldman Sachs — the Street years that overlap Dan’s, and the other half of a diner-booth argument about comics, movies, tech, politics, and markets.",
    experience: [
      {
        title: "Co-host",
        org: "SpaceBat",
        dates: "2026 – Present",
        detail: "Comics, movies, tech, politics, markets.",
      },
      {
        title: "Goldman Sachs",
        org: "Goldman Sachs",
        dates: "",
      },
    ],
    education: [],
    facts: [
      "Goldman Sachs",
      "Former colleague from the floor years",
      "The comics half of the booth",
      "Movies, politics, and whatever just broke on the tape",
    ],
  },
};

export const storyRecord = [
  {
    kicker: "15 Mar 2009 · 19:43 EDT",
    title: "Pad 39A, Kennedy Space Center",
    body: "Space Shuttle Discovery stands on the pad for STS-119, a night launch to the International Space Station. The sky is already on fire. On the orange foam of the external tank, something small is moving.",
  },
  {
    kicker: "Wildlife",
    title: "Not a fruit bat",
    body: "First reports called it a fruit bat. NASA later confirmed a free-tailed bat. A wildlife specialist, reading the video, said the animal likely had a broken left wing and trouble in the right shoulder or wrist. It could not fly off.",
  },
  {
    kicker: "ICE-01",
    title: "They signed a waiver",
    body: "The final inspection team — ICE — logged the animal as Interim Problem Report 119V-0080. Systems engineering ran a debris analysis. A Launch Commit Criteria waiver to ICE-01 was written to accept the stowaway. NASA hoped it would wake and leave. It did not.",
  },
  {
    kicker: "Infrared",
    title: "Alive. Seventy degrees.",
    body: "The foam never dropped below 60°F. Infrared showed the bat at about 70°F through countdown — warm, not frozen to the tank as many assumed. It changed direction from time to time. It never let go.",
  },
  {
    kicker: "Liftoff",
    title: "Past the tower",
    body: "Discovery lifted at 7:43 p.m. EDT. Launch imagery confirmed the bat held on until the vehicle at least cleared the tower. After that, the cameras lost him. NASA’s line: the animal likely perished quickly during the climb to orbit.",
  },
];

export const storyLegend = [
  {
    kicker: "The name",
    title: "We stole it",
    body: "Mission Control posted a cartoon of an “Orbital Bat Sensing System.” Later tellings named him Brian. Gizmodo wrote the eulogy NASA would not: goodbye and godspeed, magnificent Spacebat. We took the name. Not as a documentary. As a mascot. A bat that wouldn’t let go is a decent name for a booth that won’t pick a lane.",
  },
  {
    kicker: "Tongue in cheek",
    title: "We gave him a cape",
    body: "NASA’s line is he likely perished on the climb. We like to imagine he didn’t — powers, a foam cape, a return. That’s the drawing on the cover. It is not the show. The show is comics, movies, tech, politics, and markets.",
  },
];

export const beats = [
  { label: "Comics", cover: "/images/ep-comics.webp" },
  { label: "Movies", cover: "/images/ep-movies.webp" },
  { label: "Tech", cover: "/images/ep-tech.webp" },
  { label: "Politics", cover: "/images/ep-politics.webp" },
  { label: "Markets", cover: "/images/ep-markets.webp" },
] as const;

/** Episodes go here with a listenUrl when John and Dan publish one. */
export const episodes: Episode[] = [];

export const publishedEpisodes = episodes.filter((e) => e.listenUrl);
export const upcomingEpisodes = episodes.filter((e) => !e.listenUrl);
export const latestEpisode = publishedEpisodes[0] ?? null;

export function getEpisode(slug: string) {
  return episodes.find((e) => e.slug === slug);
}

export function episodeIsLive(episode: Episode) {
  return Boolean(episode.listenUrl);
}

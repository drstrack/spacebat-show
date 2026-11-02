import catalog from "../data/media.json" with { type: "json" };
import { cleanImdbId, cleanPosterPath, imdbPageUrl, tmdbPageUrl, tmdbPoster } from "./tmdb.ts";

export type MediaKind = "movie" | "tv";

export type MediaEpisode = {
  slug: string;
  title: string;
  timestamp?: string;
};

/** Stored ratings, high to low. A missing row is unrated, not "haven't seen it". */
export const MEDIA_RATINGS = ["two_up", "one_up", "ok", "one_down", "two_down", "not_seen"] as const;

export type MediaRating = (typeof MEDIA_RATINGS)[number];

/** Click order on the rating page. Unrated deletes the row. */
export const MEDIA_RATING_CYCLE = [...MEDIA_RATINGS, "unrated"] as const;

export type MediaRatingChoice = (typeof MEDIA_RATING_CYCLE)[number];

export const MEDIA_RATING_LABEL: Record<MediaRatingChoice, string> = {
  two_up: "Two thumbs up",
  one_up: "One thumb up",
  ok: "OK",
  one_down: "One thumb down",
  two_down: "Two thumbs down",
  not_seen: "Haven't seen it",
  unrated: "Not rated yet",
};

export const MEDIA_RATING_MARK: Record<MediaRatingChoice, string> = {
  two_up: "👍👍",
  one_up: "👍",
  ok: "OK",
  one_down: "👎",
  two_down: "👎👎",
  not_seen: "Haven't seen it",
  unrated: "—",
};

/** The only accounts that can set a host rating. One place, not scattered. */
export const MEDIA_HOST_EMAILS = {
  john: "jack2ryan@aim.com",
  dan: "dstrack@hotmail.com",
} as const;

export type MediaHost = keyof typeof MEDIA_HOST_EMAILS;

export type MediaRatings = Record<MediaHost, MediaRatingChoice>;

export type MediaEntry = {
  id: string;
  kind: MediaKind;
  title: string;
  year: string;
  episodes: MediaEpisode[];
  wikipedia_url: string;
  image: string | null;
  image_credit: string | null;
  image_kind: "poster" | "logo" | "still" | null;
  best_guess: boolean;
  best_guess_reason: string | null;
  width?: number;
  height?: number;
  ratings: MediaRatings;
  tmdbId: number | null;
  tmdbType: MediaKind | null;
  imdbId: string | null;
  overview: string | null;
  posterPath: string | null;
};

export type MediaSort = "newest" | MediaHost;

const UNRATED: MediaRatings = { john: "unrated", dan: "unrated" };

/**
 * Published order, newest first, from the SpaceBat RSS on 1 Nov 2026.
 * A slug that is not listed sorts after these.
 */
const NEWEST_EPISODE = [
  "einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die",
  "nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch",
  "highway-to-the-dangerzone",
  "heartburn-hardware-and-the-nuclear-triad",
  "spacebat-gets-its-groove",
  "episode-zero-grok-bots-geopolitics-and-the-bat-signal",
];

const IMAGE_FILE = /^[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png)$/;

export const MEDIA_PAGE_TITLE = "Movies & TV";
export const MEDIA_PAGE_HEAD = `${MEDIA_PAGE_TITLE} · SpaceBat`;
export const MEDIA_DESCRIPTION =
  "Every movie and show John and Dan have talked about on SpaceBat.";
export const MEDIA_URL = "https://www.spacebatshow.net/movies";
export const MEDIA_OG_IMAGE = "/og.jpg";

function asCatalog(value: unknown): MediaEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (row.kind !== "movie" && row.kind !== "tv") return [];
    if (typeof row.id !== "string" || typeof row.title !== "string") return [];
    const tmdbId = typeof row.tmdb_id === "number" && row.tmdb_id > 0 ? row.tmdb_id : null;
    const wikipedia =
      typeof row.wikipedia_url === "string" && row.wikipedia_url.startsWith("https://") ? row.wikipedia_url : "";
    if (!wikipedia && tmdbId == null) return [];
    const episodes = Array.isArray(row.episodes)
      ? row.episodes.flatMap((episode) => {
          if (!episode || typeof episode !== "object") return [];
          const mention = episode as Record<string, unknown>;
          if (typeof mention.slug !== "string" || typeof mention.title !== "string") return [];
          const timestamp = typeof mention.timestamp === "string" ? mention.timestamp : undefined;
          return [{ slug: mention.slug, title: mention.title, timestamp }];
        })
      : [];
    const image = typeof row.image === "string" && IMAGE_FILE.test(row.image) ? row.image : null;
    const kind = row.image_kind === "poster" || row.image_kind === "logo" || row.image_kind === "still"
      ? row.image_kind
      : null;
    return [
      {
        id: row.id,
        kind: row.kind,
        title: row.title,
        year: typeof row.year === "string" ? row.year : "",
        episodes,
        wikipedia_url: wikipedia,
        image,
        image_credit: typeof row.image_credit === "string" ? row.image_credit : null,
        image_kind: image ? kind : null,
        best_guess: row.best_guess === true,
        best_guess_reason: typeof row.best_guess_reason === "string" ? row.best_guess_reason : null,
        width: typeof row.width === "number" ? row.width : undefined,
        height: typeof row.height === "number" ? row.height : undefined,
        ratings: readRatings(row.ratings),
        tmdbId,
        tmdbType: row.tmdb_type === "movie" || row.tmdb_type === "tv" ? row.tmdb_type : null,
        imdbId: cleanImdbId(row.imdb_id),
        overview: typeof row.overview === "string" ? row.overview : null,
        posterPath: cleanPosterPath(row.poster_path),
      },
    ];
  });
}

function readRatings(value: unknown): MediaRatings {
  if (!value || typeof value !== "object") return { ...UNRATED };
  const row = value as Record<string, unknown>;
  return {
    john: isRating(row.john) ? row.john : "unrated",
    dan: isRating(row.dan) ? row.dan : "unrated",
  };
}

export function isRating(value: unknown): value is MediaRating {
  return typeof value === "string" && (MEDIA_RATINGS as readonly string[]).includes(value);
}

export function isRatingChoice(value: unknown): value is MediaRatingChoice {
  return typeof value === "string" && (MEDIA_RATING_CYCLE as readonly string[]).includes(value);
}

export function hostForEmail(email: string | null | undefined): MediaHost | null {
  const value = email?.trim().toLowerCase() ?? "";
  if (value === MEDIA_HOST_EMAILS.john) return "john";
  if (value === MEDIA_HOST_EMAILS.dan) return "dan";
  return null;
}

/**
 * Same crew check as the rest of the back end: a signed-in admin.
 * Create, edit, and delete all use this before any write.
 */
export function mediaAdminDecision(input: {
  signedIn: boolean;
  role: string | null | undefined;
}): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (!input.signedIn) return { ok: false, status: 401, error: "Unauthorized" };
  if (input.role !== "admin") return { ok: false, status: 403, error: "Crew only." };
  return { ok: true };
}

/**
 * John can set John's rating. Dan can set Dan's. Another admin, or anyone
 * who is not an admin, cannot set either.
 */
export function mediaRatingDecision(input: {
  signedIn: boolean;
  role: string | null | undefined;
  email: string | null | undefined;
  host: MediaHost;
}): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  const admin = mediaAdminDecision({ signedIn: input.signedIn, role: input.role });
  if (!admin.ok) return admin;
  if (hostForEmail(input.email) !== input.host) {
    return { ok: false, status: 403, error: "You can only set your own rating." };
  }
  return { ok: true };
}

export const mediaCatalog: readonly MediaEntry[] = asCatalog(catalog);

export function episodeRecency(slug: string): number {
  const index = NEWEST_EPISODE.indexOf(slug);
  return index === -1 ? NEWEST_EPISODE.length : index;
}

function newestMention(entry: { episodes: readonly MediaEpisode[] }): number {
  if (entry.episodes.length === 0) return NEWEST_EPISODE.length;
  return Math.min(...entry.episodes.map((episode) => episodeRecency(episode.slug)));
}

export function ratingRank(rating: MediaRatingChoice): number {
  const index = MEDIA_RATING_CYCLE.indexOf(rating);
  return index === -1 ? MEDIA_RATING_CYCLE.length : index;
}

export function formatRating(choice: MediaRatingChoice): string {
  if (choice === "unrated") return "Not rated yet";
  const mark = MEDIA_RATING_MARK[choice];
  const label = MEDIA_RATING_LABEL[choice];
  return mark === label ? label : `${mark} ${label}`;
}

export function nextHostRating(current: MediaRatingChoice): MediaRatingChoice {
  const index = MEDIA_RATING_CYCLE.indexOf(current);
  const next = MEDIA_RATING_CYCLE[(index + 1) % MEDIA_RATING_CYCLE.length];
  return next ?? "two_up";
}

/** Unrated deletes the row. Every other step is stored, including haven't seen it. */
export function ratingWrite(
  choice: MediaRatingChoice,
): { action: "delete" } | { action: "upsert"; rating: MediaRating } {
  if (choice === "unrated") return { action: "delete" };
  return { action: "upsert", rating: choice };
}

export type RatingView = "unrated" | "rated" | "not_seen" | "all";

/** Saved thumbs and OK are rated. Haven't seen it is its own bucket. */
export function ratingBucket(choice: MediaRatingChoice): Exclude<RatingView, "all"> {
  if (choice === "unrated" || choice === "not_seen") return choice;
  return "rated";
}

export function ratingViewCount(
  entries: readonly MediaEntry[],
  host: MediaHost,
  view: RatingView,
): number {
  if (view === "all") return entries.length;
  return entries.filter((entry) => ratingBucket(entry.ratings[host]) === view).length;
}

export function unratedCount(entries: readonly MediaEntry[], host: MediaHost): number {
  return ratingViewCount(entries, host, "unrated");
}

export function idsForRatingView(
  entries: readonly MediaEntry[],
  host: MediaHost,
  view: RatingView,
): string[] {
  if (view === "all") return entries.map((entry) => entry.id);
  return entries.filter((entry) => ratingBucket(entry.ratings[host]) === view).map((entry) => entry.id);
}

/** Keep a captured view even after a title in it is saved. */
export function holdVisibleIds(captured: readonly string[], entries: readonly MediaEntry[]): MediaEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return captured.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
}

/** Unrated titles first for that host. Everyone else keeps title order. */
export function orderForRater(entries: readonly MediaEntry[], host: MediaHost | null): MediaEntry[] {
  const byTitle = (list: readonly MediaEntry[]) =>
    list.slice().sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
  if (!host) return byTitle(entries);
  const unrated = entries.filter((entry) => entry.ratings[host] === "unrated");
  const rated = entries.filter((entry) => entry.ratings[host] !== "unrated");
  return [...byTitle(unrated), ...byTitle(rated)];
}

/** Keep the ids from the last sort. A rating change does not move a card. */
export function applyStableOrder(ids: readonly string[], entries: readonly MediaEntry[]): MediaEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  for (const entry of entries) {
    if (!ids.includes(entry.id)) ordered.push(entry);
  }
  return ordered;
}

/** Newest episode mention first, unless a host rating is requested. Ties are A to Z. */
export function sortMedia(entries: readonly MediaEntry[], sort: MediaSort = "newest"): MediaEntry[] {
  return entries
    .map((entry) => ({
      ...entry,
      episodes: entry.episodes.slice().sort((a, b) => {
        const rank = episodeRecency(a.slug) - episodeRecency(b.slug);
        if (rank !== 0) return rank;
        return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
      }),
    }))
    .sort((a, b) => {
      const rank =
        sort === "newest"
          ? newestMention(a) - newestMention(b)
          : ratingRank(a.ratings[sort]) - ratingRank(b.ratings[sort]);
      if (rank !== 0) return rank;
      return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    });
}

export function mediaByKind(
  kind: MediaKind,
  entries: readonly MediaEntry[] = mediaCatalog,
  sort: MediaSort = "newest",
): MediaEntry[] {
  return sortMedia(
    entries.filter((entry) => entry.kind === kind),
    sort,
  );
}

export function mediaCounts(entries: readonly MediaEntry[] = mediaCatalog): { movies: number; tv: number } {
  return {
    movies: entries.filter((entry) => entry.kind === "movie").length,
    tv: entries.filter((entry) => entry.kind === "tv").length,
  };
}

export function mediaTabLabel(
  tab: "movies" | "tv",
  entries: readonly MediaEntry[] = mediaCatalog,
): string {
  const counts = mediaCounts(entries);
  return tab === "movies" ? `Movies (${counts.movies})` : `TV (${counts.tv})`;
}

export function newestMentionRank(entry: { episodes: readonly MediaEpisode[] }): number {
  return newestMention(entry);
}

export function formatTimestamp(value: string): string {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const hours = Number(match[1]);
  const minutes = match[2] ?? "00";
  const seconds = match[3] ?? "00";
  if (hours === 0) return `${Number(minutes)}:${seconds}`;
  return `${hours}:${minutes}:${seconds}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function altFor(entry: MediaEntry): string {
  return entry.image_kind === "logo" ? `${entry.title} logo` : `${entry.title} poster`;
}

export function mediaImageSrc(image: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("/") || image.startsWith("https://")) return image;
  return `/media/${image}`;
}

function ratingHtml(host: MediaHost, rating: MediaRatingChoice): string {
  const name = host === "john" ? "John" : "Dan";
  const label = MEDIA_RATING_LABEL[rating];
  return `<span class="media-rating">${name}: <span aria-label="${escapeHtml(label)}">${MEDIA_RATING_MARK[rating]}</span></span>`;
}

/** Custom upload beats a TMDB poster, which beats the local /media file. */
export function mediaPicture(entry: Pick<MediaEntry, "image" | "image_kind" | "posterPath" | "width" | "height" | "title">): {
  src: string;
  srcset: string;
  width?: number;
  height?: number;
  logo: boolean;
  fallback: string;
} | null {
  const local = entry.image && !entry.image.startsWith("https://") ? mediaImageSrc(entry.image) : null;
  const custom = entry.image?.startsWith("https://") ? entry.image : null;
  if (custom) {
    return {
      src: custom,
      srcset: "",
      width: entry.width,
      height: entry.height,
      logo: entry.image_kind === "logo",
      fallback: "",
    };
  }
  const poster = tmdbPoster(entry.posterPath);
  if (poster) {
    return {
      src: poster.src,
      srcset: poster.srcset,
      width: poster.width,
      height: poster.height,
      logo: false,
      fallback: local ?? "",
    };
  }
  if (!local) return null;
  return {
    src: local,
    srcset: "",
    width: entry.width,
    height: entry.height,
    logo: entry.image_kind === "logo",
    fallback: "",
  };
}

export function mediaPrimaryUrl(entry: Pick<MediaEntry, "tmdbId" | "tmdbType" | "wikipedia_url" | "imdbId">): string | null {
  if (entry.tmdbId && entry.tmdbType) return tmdbPageUrl({ tmdbId: entry.tmdbId, tmdbType: entry.tmdbType });
  if (entry.wikipedia_url) return entry.wikipedia_url;
  return imdbPageUrl(entry.imdbId);
}

export function mediaSecondaryLinks(
  entry: Pick<MediaEntry, "tmdbId" | "tmdbType" | "wikipedia_url" | "imdbId">,
): { label: string; href: string }[] {
  const primary = mediaPrimaryUrl(entry);
  const links: { label: string; href: string }[] = [];
  if (entry.tmdbId && entry.tmdbType) {
    const href = tmdbPageUrl({ tmdbId: entry.tmdbId, tmdbType: entry.tmdbType });
    if (href !== primary) links.push({ label: "TMDB", href });
  }
  if (entry.wikipedia_url && entry.wikipedia_url !== primary) {
    links.push({ label: "Wikipedia", href: entry.wikipedia_url });
  }
  const imdb = imdbPageUrl(entry.imdbId);
  if (imdb && imdb !== primary) links.push({ label: "IMDb", href: imdb });
  return links;
}

export function renderMediaGrid(entries: readonly MediaEntry[]): string {
  return entries
    .map((entry) => {
      const picture = mediaPicture(entry);
      const shot = picture
        ? `<div class="media-shot${picture.logo ? " media-shot-logo" : ""}"><img class="media-shot-img" src="${escapeHtml(picture.src)}"${
            picture.srcset ? ` srcset="${escapeHtml(picture.srcset)}" sizes="(min-width: 1024px) 220px, 45vw"` : ""
          } alt="${escapeHtml(altFor(entry))}"${
            picture.width && picture.height ? ` width="${picture.width}" height="${picture.height}"` : ""
          }${picture.fallback ? ` data-fallback="${escapeHtml(picture.fallback)}"` : ""} loading="lazy" decoding="async"${
            picture.fallback
              ? ` onerror="if(this.dataset.fallback){this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.fallback}"`
              : ""
          } /></div>`
        : `<div class="media-shot media-shot-title"><p class="media-title-card">${escapeHtml(entry.title)}</p></div>`;
      const year = entry.year ? ` <span class="media-year">(${escapeHtml(entry.year)})</span>` : "";
      const credit = entry.image_credit
        ? `<p class="media-credit">${escapeHtml(entry.image_credit)}</p>`
        : "";
      const episodes = entry.episodes
        .map((episode) => {
          const when = episode.timestamp
            ? ` <span class="media-time">${escapeHtml(formatTimestamp(episode.timestamp))}</span>`
            : "";
          return `<a class="media-episode" href="/podcast/${escapeHtml(episode.slug)}">${escapeHtml(episode.title)}</a>${when}`;
        })
        .join("");
      const guess = entry.best_guess
        ? `<p class="media-guess">Best guess.${entry.best_guess_reason ? ` ${escapeHtml(entry.best_guess_reason)}` : ""}</p>`
        : "";
      const ratings = `<p class="media-ratings">${ratingHtml("john", entry.ratings.john)} ${ratingHtml("dan", entry.ratings.dan)}</p>`;
      const overview = entry.overview
        ? `<p class="media-overview">${escapeHtml(entry.overview)}</p>`
        : "";
      const secondary = mediaSecondaryLinks(entry)
        .map(
          (link) =>
            `<a class="media-extra" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
        )
        .join("");
      const extras = secondary ? `<p class="media-links">${secondary}</p>` : "";
      const primary = mediaPrimaryUrl(entry);
      const frame = `<figure class="comic-panel">${shot}<figcaption class="comic-caption">${escapeHtml(entry.title)}${year}</figcaption></figure>`;
      const linked = primary
        ? `<a class="comic-frame-link" href="${escapeHtml(primary)}" target="_blank" rel="noopener noreferrer">${frame}</a>`
        : frame;
      return `<article class="media-card" data-media-id="${escapeHtml(entry.id)}">${linked}${ratings}${credit}${overview}${extras}<p class="media-episodes">${episodes}</p>${guess}</article>`;
    })
    .join("");
}

export function renderMediaTabs(): string {
  const counts = mediaCounts();
  return `<div role="tablist" aria-label="Movies and TV"><button type="button" role="tab" id="media-tab-movies" aria-selected="true" aria-controls="media-panel-movies">Movies (${counts.movies})</button><button type="button" role="tab" id="media-tab-tv" aria-selected="false" aria-controls="media-panel-tv">TV (${counts.tv})</button></div>`;
}

export type MediaDraft = {
  kind: MediaKind;
  title: string;
  year: string;
  wikipediaUrl: string;
  image: string | null;
  imageCredit: string | null;
  imageKind: "poster" | "logo" | "still" | null;
  bestGuess: boolean;
  bestGuessReason: string | null;
  episodes: MediaEpisode[];
  tmdbId: number | null;
  tmdbType: MediaKind | null;
  imdbId: string | null;
  overview: string | null;
  posterPath: string | null;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_IMAGE = /^\/media\/[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png|webp|gif)$/;

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKC")
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "title";
}

export function episodeLines(episodes: readonly MediaEpisode[]): string {
  return episodes
    .map((episode) =>
      episode.timestamp
        ? `${episode.slug} | ${episode.title} | ${episode.timestamp}`
        : `${episode.slug} | ${episode.title}`,
    )
    .join("\n");
}

export function parseEpisodeLines(raw: string): MediaEpisode[] | { error: string } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 20) return { error: "Keep episode mentions to 20 or fewer." };
  const episodes: MediaEpisode[] = [];
  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim());
    const slug = parts[0] ?? "";
    const title = parts[1] ?? "";
    const timestamp = parts[2] || undefined;
    if (!SLUG.test(slug) || slug.length > 160) {
      return { error: "Each episode line needs a slug, then a title." };
    }
    if (!title || title.length > 200) return { error: "Each episode line needs a slug, then a title." };
    if (timestamp && !/^\d{1,2}:\d{2}:\d{2}$/.test(timestamp)) {
      return { error: "Timestamps look like 00:59:00." };
    }
    episodes.push({ slug, title, timestamp });
  }
  return episodes;
}

function cleanText(value: unknown, max: number): string | { error: string } {
  if (value == null) return "";
  if (typeof value !== "string") return { error: "That needs to be text." };
  if (value.length > max * 4) return { error: "That text is too long." };
  let cleaned = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const control = code <= 31 || code === 127;
    const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
    if (!control && !bidi) cleaned += char;
  }
  return cleaned.trim().slice(0, max);
}

export function parseMediaDraft(input: unknown): MediaDraft | { error: string } {
  if (!input || typeof input !== "object") return { error: "That title needs a name." };
  const row = input as Record<string, unknown>;
  if (row.kind !== "movie" && row.kind !== "tv") return { error: "Pick movie or TV." };
  const title = cleanText(row.title, 200);
  if (typeof title !== "string") return title;
  if (!title) return { error: "That title needs a name." };
  const year = cleanText(row.year, 32);
  if (typeof year !== "string") return year;
  const wikipedia = cleanText(row.wikipediaUrl, 500);
  if (typeof wikipedia !== "string") return wikipedia;
  let wikipediaUrl = "";
  if (wikipedia) {
    let wiki: URL;
    try {
      wiki = new URL(wikipedia);
    } catch {
      return { error: "The Wikipedia link needs to be a Wikipedia URL." };
    }
    if (wiki.protocol !== "https:" || !/(^|\.)wikipedia\.org$/i.test(wiki.hostname)) {
      return { error: "The Wikipedia link needs to be a Wikipedia URL." };
    }
    wikipediaUrl = wiki.toString();
  }
  const overview = cleanText(row.overview, 2000);
  if (typeof overview !== "string") return overview;
  const tmdbId =
    typeof row.tmdbId === "number" && Number.isInteger(row.tmdbId) && row.tmdbId > 0 ? row.tmdbId : null;
  const tmdbType = row.tmdbType === "movie" || row.tmdbType === "tv" ? row.tmdbType : null;
  const posterPath = cleanPosterPath(row.posterPath);
  const imdbId = cleanImdbId(row.imdbId);
  const imageText = cleanText(row.image, 500);
  if (typeof imageText !== "string") return imageText;
  let image: string | null = imageText || null;
  if (image && !LOCAL_IMAGE.test(image) && !isHttpsUrl(image)) {
    return { error: "Use an uploaded picture or an https image URL." };
  }
  const credit = cleanText(row.imageCredit, 300);
  if (typeof credit !== "string") return credit;
  const imageKind =
    row.imageKind === "poster" || row.imageKind === "logo" || row.imageKind === "still"
      ? row.imageKind
      : null;
  const reason = cleanText(row.bestGuessReason, 500);
  if (typeof reason !== "string") return reason;
  const episodes =
    typeof row.episodesText === "string"
      ? parseEpisodeLines(row.episodesText)
      : Array.isArray(row.episodes)
        ? parseEpisodeLines(
            row.episodes
              .map((episode) => {
                if (!episode || typeof episode !== "object") return "";
                const mention = episode as MediaEpisode;
                return mention.timestamp
                  ? `${mention.slug} | ${mention.title} | ${mention.timestamp}`
                  : `${mention.slug} | ${mention.title}`;
              })
              .join("\n"),
          )
        : [];
  if (!Array.isArray(episodes)) return episodes;
  return {
    kind: row.kind,
    title,
    year,
    wikipediaUrl,
    image,
    imageCredit: credit || null,
    imageKind: image ? imageKind ?? "poster" : null,
    bestGuess: row.bestGuess === true,
    bestGuessReason: row.bestGuess === true && reason ? reason : null,
    episodes,
    tmdbId: tmdbId && tmdbType ? tmdbId : null,
    tmdbType: tmdbId && tmdbType ? tmdbType : null,
    imdbId,
    overview: overview || null,
    posterPath,
  };
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const MEDIA_BLOB_PATH =
  /^media\/\d{4}-\d{2}\/[a-z0-9]+-[a-z0-9][a-z0-9._-]{0,120}\.(jpg|jpeg|png|webp|gif)$/;

export function mediaBlobPathname(originalName: string, now = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const random = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const cleaned = originalName
    .split(/[/\\]/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `media/${month}/${random}-${cleaned || "image.jpg"}`;
}

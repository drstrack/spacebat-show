import catalog from "../data/media.json" with { type: "json" };

export type MediaKind = "movie" | "tv";

export type MediaEpisode = {
  slug: string;
  title: string;
  timestamp?: string;
};

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
};

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
    if (typeof row.wikipedia_url !== "string" || !row.wikipedia_url.startsWith("https://")) return [];
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
        wikipedia_url: row.wikipedia_url,
        image,
        image_credit: typeof row.image_credit === "string" ? row.image_credit : null,
        image_kind: image ? kind : null,
        best_guess: row.best_guess === true,
        best_guess_reason: typeof row.best_guess_reason === "string" ? row.best_guess_reason : null,
        width: typeof row.width === "number" ? row.width : undefined,
        height: typeof row.height === "number" ? row.height : undefined,
      },
    ];
  });
}

export const mediaCatalog: readonly MediaEntry[] = asCatalog(catalog);

export function episodeRecency(slug: string): number {
  const index = NEWEST_EPISODE.indexOf(slug);
  return index === -1 ? NEWEST_EPISODE.length : index;
}

function newestMention(entry: MediaEntry): number {
  if (entry.episodes.length === 0) return NEWEST_EPISODE.length;
  return Math.min(...entry.episodes.map((episode) => episodeRecency(episode.slug)));
}

/** Newest episode mention first. Same episode, then A to Z. */
export function sortMedia(entries: readonly MediaEntry[]): MediaEntry[] {
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
      const rank = newestMention(a) - newestMention(b);
      if (rank !== 0) return rank;
      return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    });
}

export function mediaByKind(kind: MediaKind): MediaEntry[] {
  return sortMedia(mediaCatalog.filter((entry) => entry.kind === kind));
}

export function mediaCounts(): { movies: number; tv: number } {
  return {
    movies: mediaCatalog.filter((entry) => entry.kind === "movie").length,
    tv: mediaCatalog.filter((entry) => entry.kind === "tv").length,
  };
}

export function mediaTabLabel(tab: "movies" | "tv"): string {
  const counts = mediaCounts();
  return tab === "movies" ? `Movies (${counts.movies})` : `TV (${counts.tv})`;
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

export function renderMediaGrid(entries: readonly MediaEntry[]): string {
  return entries
    .map((entry) => {
      const shot = entry.image
        ? `<div class="media-shot${entry.image_kind === "logo" ? " media-shot-logo" : ""}"><img class="media-shot-img" src="/media/${escapeHtml(entry.image)}" alt="${escapeHtml(altFor(entry))}"${
            entry.width && entry.height ? ` width="${entry.width}" height="${entry.height}"` : ""
          } loading="lazy" decoding="async" /></div>`
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
      return `<article class="media-card" data-media-id="${escapeHtml(entry.id)}"><a class="comic-frame-link" href="${escapeHtml(entry.wikipedia_url)}" target="_blank" rel="noopener noreferrer"><figure class="comic-panel">${shot}<figcaption class="comic-caption">${escapeHtml(entry.title)}${year}</figcaption></figure></a>${credit}<p class="media-episodes">${episodes}</p>${guess}</article>`;
    })
    .join("");
}

export function renderMediaTabs(): string {
  const counts = mediaCounts();
  return `<div role="tablist" aria-label="Movies and TV"><button type="button" role="tab" id="media-tab-movies" aria-selected="true" aria-controls="media-panel-movies">Movies (${counts.movies})</button><button type="button" role="tab" id="media-tab-tv" aria-selected="false" aria-controls="media-panel-tv">TV (${counts.tv})</button></div>`;
}

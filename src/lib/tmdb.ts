/** Pure TMDB shapes. No network and no API key. */

export const TMDB_KEY_MISSING = "TMDB key not configured";
export const TMDB_NOTICE = "This product uses the TMDB API but is not endorsed or certified by TMDB.";

export type TmdbType = "movie" | "tv";

export type TmdbHit = {
  tmdbId: number;
  tmdbType: TmdbType;
  title: string;
  year: string;
  overview: string;
  posterPath: string | null;
  imdbId: string | null;
};

export type TmdbKey = { mode: "v3"; key: string } | { mode: "v4"; token: string };

/** A v4 read-access token is a JWT. Anything else is a v3 api_key. */
export function classifyTmdbKey(raw: string | null | undefined): TmdbKey | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return { mode: "v4", token: value };
  }
  return { mode: "v3", key: value };
}

const POSTER_PATH = /^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/;
const IMDB_ID = /^tt\d{1,10}$/;

export function cleanPosterPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!POSTER_PATH.test(path) || path.includes("..")) return null;
  return path;
}

export function cleanImdbId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return IMDB_ID.test(id) ? id : null;
}

function yearOf(value: unknown): string {
  if (typeof value !== "string") return "";
  const year = value.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "";
}

function text(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function mapTmdbSearchResult(kind: TmdbType, raw: unknown): TmdbHit | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const title = text(kind === "tv" ? row.name : row.title, 200);
  if (!title) return null;
  return {
    tmdbId: id,
    tmdbType: kind,
    title,
    year: yearOf(kind === "tv" ? row.first_air_date : row.release_date),
    overview: text(row.overview),
    posterPath: cleanPosterPath(row.poster_path),
    imdbId: null,
  };
}

export function mapTmdbDetails(kind: TmdbType, raw: unknown): TmdbHit | null {
  const hit = mapTmdbSearchResult(kind, raw);
  if (!hit || !raw || typeof raw !== "object") return hit;
  const row = raw as Record<string, unknown>;
  const external = row.external_ids;
  const imdb =
    external && typeof external === "object"
      ? cleanImdbId((external as Record<string, unknown>).imdb_id)
      : cleanImdbId(row.imdb_id);
  return { ...hit, imdbId: imdb };
}

export function tmdbPageUrl(hit: { tmdbId: number; tmdbType: TmdbType }): string {
  return `https://www.themoviedb.org/${hit.tmdbType}/${hit.tmdbId}`;
}

export function imdbPageUrl(imdbId: string | null): string | null {
  const id = cleanImdbId(imdbId);
  return id ? `https://www.imdb.com/title/${id}/` : null;
}

/** w342 is the default. srcset covers a phone column through a wide card. */
export function tmdbPoster(posterPath: string | null): { src: string; srcset: string; width: number; height: number } | null {
  const path = cleanPosterPath(posterPath);
  if (!path) return null;
  const src = `https://image.tmdb.org/t/p/w342${path}`;
  const srcset = [185, 342, 500]
    .map((width) => `https://image.tmdb.org/t/p/w${width}${path} ${width}w`)
    .join(", ");
  return { src, srcset, width: 342, height: 513 };
}

export function scoreTmdbHit(
  wanted: { title: string; year: string },
  hit: TmdbHit,
): number {
  const title = wanted.title.trim().toLowerCase();
  const candidate = hit.title.trim().toLowerCase();
  let score = 0;
  if (title && candidate === title) score += 100;
  else if (title && (candidate.includes(title) || title.includes(candidate))) score += 40;
  if (wanted.year && hit.year === wanted.year) score += 30;
  return score;
}

/** Best proposal for review. Nothing is saved here. */
export function chooseTmdbMatch(wanted: { title: string; year: string }, hits: readonly TmdbHit[]): TmdbHit | null {
  let best: TmdbHit | null = null;
  let bestScore = 0;
  for (const hit of hits) {
    const score = scoreTmdbHit(wanted, hit);
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : hits[0] ?? null;
}

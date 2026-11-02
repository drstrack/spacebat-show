/**
 * Server-only TMDB client. The key stays in this module.
 * Pass a fetch implementation in tests. Never log the key or the request URL,
 * because a v3 key is a query parameter.
 */

import {
  chooseTmdbMatch,
  classifyTmdbKey,
  mapTmdbDetails,
  mapTmdbSearchResult,
  TMDB_KEY_MISSING,
  type TmdbHit,
  type TmdbKey,
  type TmdbType,
} from "./tmdb.ts";

export type TmdbFetch = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type TmdbResult<T> =
  | { configured: true; results: T }
  | { configured: false; error: typeof TMDB_KEY_MISSING; results: T };

const browserFetch: TmdbFetch = async (input, init) => fetch(input, init);

function keyFrom(env: Record<string, string | undefined> | undefined): TmdbKey | null {
  return classifyTmdbKey(env?.TMDB_API_KEY);
}

async function tmdbGet(
  path: string,
  query: Record<string, string>,
  options: { key: TmdbKey; fetch: TmdbFetch },
): Promise<unknown> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [name, value] of Object.entries(query)) {
    if (value) url.searchParams.set(name, value);
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.key.mode === "v3") url.searchParams.set("api_key", options.key.key);
  else headers.authorization = `Bearer ${options.key.token}`;
  const response = await options.fetch(url.toString(), { headers });
  if (!response.ok) {
    console.error("tmdb", path, response.status);
    throw new Error(`TMDB returned ${response.status}`);
  }
  return response.json();
}

export async function searchTmdb(
  input: { title: string; year?: string; kind: TmdbType },
  options?: { env?: Record<string, string | undefined>; fetch?: TmdbFetch },
): Promise<TmdbResult<TmdbHit[]>> {
  const key = keyFrom(options?.env ?? process.env);
  if (!key) return { configured: false, error: TMDB_KEY_MISSING, results: [] };
  const title = input.title.trim();
  if (!title) return { configured: true, results: [] };
  const path = input.kind === "tv" ? "/search/tv" : "/search/movie";
  const year = input.year?.trim() ?? "";
  const payload = await tmdbGet(
    path,
    {
      query: title,
      include_adult: "false",
      ...(input.kind === "tv" ? { first_air_date_year: year } : { year }),
    },
    { key, fetch: options?.fetch ?? browserFetch },
  );
  const rows =
    payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)
      ? (payload as { results: unknown[] }).results
      : [];
  const results = rows
    .slice(0, 8)
    .flatMap((row) => {
      const hit = mapTmdbSearchResult(input.kind, row);
      return hit ? [hit] : [];
    });
  return { configured: true, results };
}

export async function lookupTmdb(
  input: { tmdbId: number; tmdbType: TmdbType },
  options?: { env?: Record<string, string | undefined>; fetch?: TmdbFetch },
): Promise<TmdbResult<TmdbHit | null>> {
  const key = keyFrom(options?.env ?? process.env);
  if (!key) return { configured: false, error: TMDB_KEY_MISSING, results: null };
  if (!Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
    return { configured: true, results: null };
  }
  const path = input.tmdbType === "tv" ? `/tv/${input.tmdbId}` : `/movie/${input.tmdbId}`;
  const payload = await tmdbGet(
    path,
    { append_to_response: "external_ids" },
    { key, fetch: options?.fetch ?? browserFetch },
  );
  return { configured: true, results: mapTmdbDetails(input.tmdbType, payload) };
}

export async function proposeTmdbMatches(
  items: readonly { id: string; title: string; year: string; kind: TmdbType; bestGuess: boolean }[],
  options?: { env?: Record<string, string | undefined>; fetch?: TmdbFetch },
): Promise<
  TmdbResult<{ id: string; title: string; bestGuess: boolean; proposal: TmdbHit | null }[]>
> {
  const key = keyFrom(options?.env ?? process.env);
  if (!key) return { configured: false, error: TMDB_KEY_MISSING, results: [] };
  const proposals = [];
  for (const item of items) {
    const found = await searchTmdb(
      { title: item.title, year: item.year, kind: item.kind },
      { env: options?.env, fetch: options?.fetch },
    );
    proposals.push({
      id: item.id,
      title: item.title,
      bestGuess: item.bestGuess,
      proposal: chooseTmdbMatch({ title: item.title, year: item.year }, found.results),
    });
  }
  return { configured: true, results: proposals };
}

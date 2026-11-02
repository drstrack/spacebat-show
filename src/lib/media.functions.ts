import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isRatingChoice, type MediaRatingChoice } from "@/lib/media";
import {
  applyMediaTmdbMatch,
  deleteMediaItem,
  loadMoviesPage,
  lookupMediaOnTmdb,
  proposeMediaTmdbMatches,
  refreshMediaFromTmdb,
  saveMediaItem,
  searchMediaOnTmdb,
  setMediaRating,
} from "@/lib/media.server";

export const loadMovies = createServerFn({ method: "GET" }).handler(async () => loadMoviesPage());

export const saveMovie = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; draft?: unknown }) => {
    if (!input || typeof input !== "object") throw new Error("That title needs a name.");
    if (input.id != null && (typeof input.id !== "string" || !input.id)) {
      throw new Error("That title isn't on the page.");
    }
    return { id: input.id, draft: input.draft };
  })
  .handler(async ({ data, context }) => saveMediaItem(context.userId, data));

export const deleteMovie = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => {
    if (!input || typeof input.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) {
      throw new Error("That title isn't on the page.");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await deleteMediaItem(context.userId, data.id);
    return { ok: true as const };
  });

export const searchTmdbTitles = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title?: string; year?: string; kind?: string }) => {
    if (!input || (input.kind !== "movie" && input.kind !== "tv")) throw new Error("Pick movie or TV.");
    if (typeof input.title !== "string" || !input.title.trim()) throw new Error("That title needs a name.");
    return {
      title: input.title.trim().slice(0, 200),
      year: typeof input.year === "string" ? input.year.trim().slice(0, 8) : "",
      kind: input.kind === "tv" ? ("tv" as const) : ("movie" as const),
    };
  })
  .handler(async ({ data, context }) => searchMediaOnTmdb(context.userId, data));

export const lookupTmdbTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tmdbId?: number; tmdbType?: string }) => {
    if (!input || typeof input.tmdbId !== "number" || !Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
      throw new Error("That TMDB id isn't valid.");
    }
    if (input.tmdbType !== "movie" && input.tmdbType !== "tv") throw new Error("Pick movie or TV.");
    return { tmdbId: input.tmdbId, tmdbType: input.tmdbType === "tv" ? ("tv" as const) : ("movie" as const) };
  })
  .handler(async ({ data, context }) => lookupMediaOnTmdb(context.userId, data));

export const refreshTmdbTitle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => {
    if (!input || typeof input.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) {
      throw new Error("That title isn't on the page.");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => refreshMediaFromTmdb(context.userId, data.id));

export const matchAllTmdb = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => proposeMediaTmdbMatches(context.userId));

export const applyTmdbMatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; tmdbId?: number; tmdbType?: string }) => {
    if (!input || typeof input.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) {
      throw new Error("That title isn't on the page.");
    }
    if (typeof input.tmdbId !== "number" || !Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
      throw new Error("That TMDB id isn't valid.");
    }
    if (input.tmdbType !== "movie" && input.tmdbType !== "tv") throw new Error("Pick movie or TV.");
    return {
      id: input.id,
      tmdbId: input.tmdbId,
      tmdbType: input.tmdbType === "tv" ? ("tv" as const) : ("movie" as const),
    };
  })
  .handler(async ({ data, context }) => applyMediaTmdbMatch(context.userId, data));

export const rateMovie = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; rating?: string }) => {
    if (!input || typeof input.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) {
      throw new Error("That title isn't on the page.");
    }
    if (!isRatingChoice(input.rating)) throw new Error("Pick a rating.");
    return { id: input.id, rating: input.rating as MediaRatingChoice };
  })
  .handler(async ({ data, context }) => {
    await setMediaRating(context.userId, data);
    return { ok: true as const };
  });

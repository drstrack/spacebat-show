import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isRating, type MediaRating } from "@/lib/media";
import { deleteMediaItem, loadMoviesPage, saveMediaItem, setMediaRating } from "@/lib/media.server";

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

export const rateMovie = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; rating?: string }) => {
    if (!input || typeof input.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) {
      throw new Error("That title isn't on the page.");
    }
    if (!isRating(input.rating)) throw new Error("Pick a rating.");
    return { id: input.id, rating: input.rating as MediaRating };
  })
  .handler(async ({ data, context }) => {
    await setMediaRating(context.userId, data);
    return { ok: true as const };
  });

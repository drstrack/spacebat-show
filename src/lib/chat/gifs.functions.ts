import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { searchGifs as findGifs, type GifHit } from "@/lib/chat/gifs.server";

export type { GifHit } from "@/lib/chat/gifs.server";

export const searchGifs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { q: string }) => {
    if (!input || typeof input.q !== "string") throw new Error("Type a search.");
    const q = input.q.trim();
    if (!q || q.length > 50) throw new Error("Type a search.");
    return { q };
  })
  .handler(async ({ data, context }): Promise<GifHit[]> => findGifs(context.userId, data.q));

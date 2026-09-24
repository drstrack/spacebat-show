import { createServerFn } from "@tanstack/react-start";
import type { Episode } from "@/data/show";
import { show } from "@/data/show";
import { parsePublishedEpisodes } from "@/lib/podcast-feed";

let cache: { at: number; episodes: Episode[] } | null = null;
const TTL_MS = 60_000;

/** Posted Podhome episodes only. The live stream is not an episode. */
export const loadPublishedEpisodes = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.episodes;
  try {
    const res = await fetch(show.feedUrl, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return cache?.episodes ?? [];
    const episodes = parsePublishedEpisodes(await res.text());
    cache = { at: now, episodes };
    return episodes;
  } catch {
    return cache?.episodes ?? [];
  }
});

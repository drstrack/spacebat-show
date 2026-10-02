import { createServerFn } from "@tanstack/react-start";
import type { Episode } from "@/data/show";
import { show } from "@/data/show";
import { feedIsLive, parseChapters, parsePublishedEpisodes } from "@/lib/podcast-feed";

let cache: { at: number; episodes: Episode[]; live: boolean } | null = null;
const TTL_MS = 60_000;

async function readFeed() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache;
  const res = await fetch(show.feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) return cache;
  const xml = await res.text();
  cache = {
    at: now,
    live: feedIsLive(xml),
    episodes: parsePublishedEpisodes(xml),
  };
  return cache;
}

/** Posted Podhome episodes only. The live stream is not an episode. */
export const loadPublishedEpisodes = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const feed = await readFeed();
    return feed?.episodes ?? [];
  } catch {
    return cache?.episodes ?? [];
  }
});

/** Live booth if the show is on the air, otherwise the newest posted episode. */
export const loadListenTarget = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const feed = await readFeed();
    return {
      live: feed?.live ?? false,
      slug: feed?.episodes[0]?.slug ?? null,
    };
  } catch {
    return { live: false, slug: cache?.episodes[0]?.slug ?? null };
  }
});

const CHAPTER_HOST = "assets.podhome.fm";

/** Podcasting 2.0 chapters for one posted episode. */
export const loadEpisodeChapters = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const feed = await readFeed();
    const url = feed?.episodes.find((episode) => episode.slug === slug)?.chaptersUrl;
    if (!url) return [];
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return [];
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== CHAPTER_HOST) return [];
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    return parseChapters(await res.json());
  });
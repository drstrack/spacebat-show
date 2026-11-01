/** Shared by the home page and the podcast page. */
export const topicTiles = [
  {
    label: "Comics",
    image: "/images/ep-comics.webp",
    href: "/comic/collection",
    accessibleName: "Comics: see John's collection",
  },
  {
    label: "Movies",
    image: "/images/ep-movies.webp",
    href: "/podcast#episodes",
    accessibleName: "Movies: see episodes",
  },
  {
    label: "Tech",
    image: "/images/ep-tech.webp",
    href: "/podcast#episodes",
    accessibleName: "Tech: see episodes",
  },
  {
    label: "Politics",
    image: "/images/ep-politics.webp",
    href: "/podcast#episodes",
    accessibleName: "Politics: see episodes",
  },
  {
    label: "Markets",
    image: "/images/ep-markets.webp",
    href: "/podcast#episodes",
    accessibleName: "Markets: see episodes",
  },
] as const;

export type TopicTile = (typeof topicTiles)[number];

/** Same destination as the podcast page's Play Latest Episode button. */
export const PODCAST_LISTEN = "/listen" as const;

export function topicTileTarget(tile: TopicTile): {
  to: "/comic/collection" | "/podcast";
  hash?: "episodes";
} {
  if (tile.href === "/podcast#episodes") return { to: "/podcast", hash: "episodes" };
  return { to: "/comic/collection" };
}

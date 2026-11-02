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
    href: "/movies",
    accessibleName: "Movies: see movies & TV we've discussed",
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
  to: "/comic/collection" | "/podcast" | "/movies";
  hash?: "episodes";
} {
  if (tile.href === "/podcast#episodes") return { to: "/podcast", hash: "episodes" };
  if (tile.href === "/movies") return { to: "/movies" };
  return { to: "/comic/collection" };
}

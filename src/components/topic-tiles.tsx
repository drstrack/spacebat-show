import { Link } from "@tanstack/react-router";
import { topicTiles, topicTileTarget } from "@/lib/topic-tiles";

/** The five topic pictures. The parent supplies the grid. */
export function TopicTiles() {
  return topicTiles.map((tile) => {
    const target = topicTileTarget(tile);
    return (
      <Link
        key={tile.label}
        to={target.to}
        hash={target.hash}
        activeOptions={{ includeHash: true }}
        aria-label={tile.accessibleName}
        className="panel group relative block aspect-[3/4] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <img
          src={tile.image}
          alt=""
          className="h-full w-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
        <span className="caption-box absolute bottom-3 left-3">{tile.label}</span>
      </Link>
    );
  });
}

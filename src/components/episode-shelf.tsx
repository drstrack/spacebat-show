import { useLayoutEffect, useRef, useState } from "react";
import { EpisodeCard } from "@/components/episode-card";
import { Button } from "@/components/ui/button";
import type { Episode } from "@/data/show";
import { episodeShelfHasMore, visibleEpisodeCount } from "@/lib/episode-shelf";

export function EpisodeShelf({ episodes }: { episodes: Episode[] }) {
  const [pages, setPages] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollLock = useRef<number | null>(null);
  const pendingFocusSlug = useRef<string | null>(null);
  const restoreButtonFocus = useRef(false);
  const visible = visibleEpisodeCount(episodes.length, pages);
  const shown = episodes.slice(0, visible);
  const hasMore = episodeShelfHasMore(episodes.length, pages);

  useLayoutEffect(() => {
    const slug = pendingFocusSlug.current;
    if (slug) {
      pendingFocusSlug.current = null;
      restoreButtonFocus.current = false;
      document.getElementById(`episode-card-${slug}`)?.focus({ preventScroll: true });
    } else if (restoreButtonFocus.current) {
      restoreButtonFocus.current = false;
      buttonRef.current?.focus({ preventScroll: true });
    }
    if (scrollLock.current != null) {
      window.scrollTo(0, scrollLock.current);
      scrollLock.current = null;
    }
  }, [pages]);

  function revealMore() {
    const nextVisible = visibleEpisodeCount(episodes.length, pages + 1);
    const firstNew = episodes[visible];
    scrollLock.current = window.scrollY;
    listRef.current?.focus({ preventScroll: true });
    if (nextVisible >= episodes.length && firstNew) {
      pendingFocusSlug.current = firstNew.slug;
      restoreButtonFocus.current = false;
    } else {
      pendingFocusSlug.current = null;
      restoreButtonFocus.current = true;
    }
    setPages((count) => count + 1);
  }

  return (
    <>
      <div
        ref={listRef}
        id="episode-list"
        tabIndex={-1}
        className="mt-6 grid gap-5 [overflow-anchor:none] outline-none"
      >
        {shown.map((episode, index) => (
          <div
            key={episode.slug}
            id={`episode-card-${episode.slug}`}
            tabIndex={-1}
            className="scroll-mt-20 outline-none"
          >
            <EpisodeCard episode={episode} featured={index === 0} />
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {visible} of {episodes.length} episodes.
      </p>
      {hasMore ? (
        <div className="mt-6 flex flex-col items-center gap-3 [overflow-anchor:none]">
          <p id="episode-shelf-count" className="text-center text-sm text-muted">
            Showing {visible} of {episodes.length}
          </p>
          <Button
            ref={buttonRef}
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            aria-controls="episode-list"
            aria-describedby="episode-shelf-count"
            onClick={revealMore}
          >
            More episodes
          </Button>
        </div>
      ) : null}
    </>
  );
}

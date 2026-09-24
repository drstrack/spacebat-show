import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Episode } from "@/data/show";
import { episodeIsLive } from "@/data/show";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function EpisodeCard({
  episode,
  featured = false,
}: {
  episode: Episode;
  featured?: boolean;
}) {
  const live = episodeIsLive(episode);

  return (
    <article
      className={cn(
        "panel group overflow-hidden bg-surface",
        featured && "md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]",
      )}
    >
      <Link
        to="/podcast/$slug"
        params={{ slug: episode.slug }}
        className="relative block aspect-square overflow-hidden border-b-4 border-ink md:aspect-auto md:min-h-56 md:border-b-0 md:border-r-4"
      >
        <img src={episode.cover} alt="" className="h-full w-full object-cover" />
        {live ? null : (
          <span className="burst absolute left-3 top-3 text-xs">Upcoming</span>
        )}
      </Link>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Episode {episode.code}</Badge>
          <span className="text-xs uppercase tracking-[0.12em] text-muted">
            {episode.dateLabel}
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-3xl leading-none tracking-wide text-ink">
            <Link to="/podcast/$slug" params={{ slug: episode.slug }}>
              {episode.title}
            </Link>
          </h3>
          <p className="text-sm leading-relaxed text-muted">{episode.teaser}</p>
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-2">
          {live && episode.listenUrl ? (
            <audio controls preload="none" src={episode.listenUrl} className="w-full" />
          ) : (
            <span className="inline-flex h-11 items-center border-4 border-ink bg-paper px-4 text-sm text-muted">
              On the pad
            </span>
          )}
          <div className="flex items-center gap-3">
            {episode.pageUrl ? (
              <a
                href={episode.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 border-4 border-ink bg-crimson px-4 font-display text-base tracking-wide text-crimson-fg shadow-[4px_4px_0_0_var(--color-ink)]"
              >
                Podhome
                <ArrowUpRight className="size-3.5" />
              </a>
            ) : null}
            <Link
              to="/podcast/$slug"
              params={{ slug: episode.slug }}
              className="font-display text-base tracking-wide text-crimson hover:underline"
            >
              Notes
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

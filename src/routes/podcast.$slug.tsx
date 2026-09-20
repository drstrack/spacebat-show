import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { episodeIsLive, episodes, getEpisode } from "@/data/show";

export const Route = createFileRoute("/podcast/$slug")({
  loader: ({ params }) => {
    const episode = getEpisode(params.slug);
    if (!episode) throw notFound();
    return episode;
  },
  component: EpisodePage,
});

function EpisodePage() {
  const episode = Route.useLoaderData();
  const live = episodeIsLive(episode);
  const others = episodes.filter((e) => e.slug !== episode.slug).slice(0, 4);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        to="/podcast"
        className="font-display text-lg tracking-wide text-crimson hover:underline"
      >
        All episodes
      </Link>
      <div className="panel mt-6 overflow-hidden">
        <img
          src={episode.cover}
          alt=""
          className="aspect-square w-full object-cover sm:aspect-video"
        />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Badge>Episode {episode.code}</Badge>
        <span className="text-xs uppercase tracking-[0.12em] text-muted">
          {episode.dateLabel}
        </span>
        {live ? null : <span className="burst text-xs">Upcoming</span>}
      </div>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">
        {episode.title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{episode.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {episode.topics.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>

      {live && episode.listenUrl ? (
        <Button className="mt-8" size="lg" asChild>
          <a href={episode.listenUrl} target="_blank" rel="noreferrer">
            Listen
            <ArrowUpRight className="size-4" />
          </a>
        </Button>
      ) : (
        <p className="panel mt-8 bg-caption px-4 py-3 text-sm text-ink">
          Still on the pad. When it publishes, the listen link lands here.{" "}
          <Link
            to="/subscribe"
            className="font-display text-lg tracking-wide text-crimson hover:underline"
          >
            Subscribe
          </Link>{" "}
          and we’ll ping you.
        </p>
      )}

      {others.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-3xl tracking-wide">More episodes</h2>
          <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
            {others.map((ep) => (
              <li key={ep.slug}>
                <Link
                  to="/podcast/$slug"
                  params={{ slug: ep.slug }}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <span>
                    <span className="font-display text-sm tracking-wide text-crimson">
                      Episode {ep.code}
                    </span>
                    <span className="mt-1 block font-display text-xl tracking-wide text-ink">
                      {ep.title}
                    </span>
                  </span>
                  <span className="text-sm text-muted">{ep.dateLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

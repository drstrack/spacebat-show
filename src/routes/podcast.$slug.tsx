import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { loadPublishedEpisodes } from "@/lib/podcast-feed.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/podcast/$slug")({
  loader: async ({ params }) => {
    const episodes = await loadPublishedEpisodes();
    const episode = episodes.find((item) => item.slug === params.slug);
    if (!episode) throw notFound();
    return {
      episode,
      others: episodes.filter((item) => item.slug !== episode.slug).slice(0, 4),
    };
  },
  component: EpisodePage,
});

function EpisodePage() {
  const { episode, others } = Route.useLoaderData();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        to="/podcast"
        hash="episodes"
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
      </div>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">
        {episode.title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{episode.description}</p>
      {episode.listenUrl ? (
        <audio controls preload="none" src={episode.listenUrl} className="mt-8 w-full" />
      ) : null}
      {episode.pageUrl ? (
        <p className="mt-4 text-sm">
          <a
            href={episode.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="font-display text-lg tracking-wide text-crimson hover:underline"
          >
            Open on Podhome
          </a>
        </p>
      ) : null}

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

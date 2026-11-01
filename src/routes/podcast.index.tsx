import { createFileRoute, Link } from "@tanstack/react-router";
import { EpisodeCard } from "@/components/episode-card";
import { HostPortrait } from "@/components/host-portrait";
import { LivePlayer } from "@/components/live-player";
import { ScheduleChangeNotice, StandingShowTime } from "@/components/schedule-change-notice";
import { TopicTiles } from "@/components/topic-tiles";
import { Button } from "@/components/ui/button";
import { hosts } from "@/data/show";
import { PODCAST_LISTEN } from "@/lib/topic-tiles";
import { loadPublishedEpisodes } from "@/lib/podcast-feed.functions";

export const Route = createFileRoute("/podcast/")({
  loader: () => loadPublishedEpisodes(),
  component: PodcastPage,
});

function PodcastPage() {
  const episodes = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <span className="caption-box">The booth</span>
      <h1 className="mt-4 font-display text-5xl tracking-wide">The Podcast</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Named for a bat who held onto a shuttle and rode it toward space — an
        amazing origin for a new superhero. John Mulligan and Daniel Strack
        started the podcast from their phone calls: comics, movies, tech,
        politics, and markets. The comic, where he comes back with powers, is
        a different project. Stay tuned.
      </p>

      <div className="mt-10 space-y-4">
        <ScheduleChangeNotice />
        <section id="live" className="panel scroll-mt-20 overflow-hidden bg-surface md:grid md:grid-cols-2">
          <Link
            to={PODCAST_LISTEN}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block md:h-full"
          >
            <img
              src="/images/cover-splash.webp"
              alt=""
              className="aspect-[2/1] w-full object-cover object-[center_30%] md:absolute md:inset-0 md:aspect-auto md:h-full md:border-r-4 md:border-ink"
            />
          </Link>
          <div className="flex flex-col justify-center bg-paper p-6 sm:p-10">
            <span className="burst w-fit text-sm">Live</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide">On the air</h2>
            <StandingShowTime className="mt-4" />
            <LivePlayer />
            <Button asChild className="mt-6 w-fit">
              <Link to={PODCAST_LISTEN}>Play Latest Episode</Link>
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TopicTiles />
      </div>

      <section id="episodes" className="mt-14 scroll-mt-20">
        <span className="caption-box">The shelf</span>
        <h2 className="mt-4 font-display text-4xl tracking-wide">Episodes</h2>
        {episodes.length > 0 ? (
          <div className="mt-6 grid gap-5">
            {episodes.map((episode, i) => (
              <EpisodeCard key={episode.slug} episode={episode} featured={i === 0} />
            ))}
          </div>
        ) : (
          <p className="panel mt-6 bg-paper px-4 py-6 text-center font-display text-2xl tracking-wide text-ink">
            No Episodes posted yet
          </p>
        )}
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="caption-box">Hosts</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide">The crew</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/hosts">Full bios</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link to="/hosts" className="panel overflow-hidden bg-surface">
            <HostPortrait host={hosts.john} />
            <div className="border-t-4 border-ink bg-paper p-5">
              <p className="font-display text-sm tracking-wide text-crimson">
                {hosts.john.role}
              </p>
              <h3 className="mt-1 font-display text-3xl tracking-wide">
                {hosts.john.name}
              </h3>
              <p className="mt-2 text-sm text-muted">{hosts.john.headline}</p>
            </div>
          </Link>
          <Link to="/hosts" className="panel overflow-hidden bg-surface">
            <HostPortrait host={hosts.dan} />
            <div className="border-t-4 border-ink bg-paper p-5">
              <p className="font-display text-sm tracking-wide text-crimson">
                {hosts.dan.role}
              </p>
              <h3 className="mt-1 font-display text-3xl tracking-wide">
                {hosts.dan.name}
              </h3>
              <p className="mt-2 text-sm text-muted">{hosts.dan.headline}</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { EpisodeCard } from "@/components/episode-card";
import { HostPortrait } from "@/components/host-portrait";
import { LivePlayer } from "@/components/live-player";
import { Button } from "@/components/ui/button";
import { beats, hosts } from "@/data/show";
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
      <h1 className="mt-4 font-display text-5xl tracking-wide">The podcast</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        John Mulligan and Daniel Strack, from a diner booth: comics, movies,
        tech, politics, and markets. Named, tongue in cheek, for the bat that
        rode Discovery — we even drew him a cape.
      </p>

      <section id="live" className="panel mt-10 overflow-hidden bg-surface md:grid md:grid-cols-2">
        <div className="relative min-h-56 md:min-h-full">
          <img
            src="/images/cover-splash.webp"
            alt="SpaceBat flying in orbit."
            className="aspect-[2/1] h-full w-full object-cover object-[center_30%] md:absolute md:inset-0 md:aspect-auto md:border-r-4 md:border-ink"
          />
        </div>
        <div className="flex flex-col justify-center bg-paper p-6 sm:p-10">
          <span className="burst w-fit text-sm">Live</span>
          <h2 className="mt-4 font-display text-4xl tracking-wide">On the air</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            The SpaceBat Show is Live every Wednesday at 8:30pm EST
          </p>
          <LivePlayer />
          <Button asChild className="mt-6 w-fit">
            <Link to="/listen">Play Latest Episode</Link>
          </Button>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {beats.map((b) => (
          <figure key={b.label} className="panel relative aspect-[3/4] overflow-hidden">
            <img src={b.cover} alt="" className="h-full w-full object-cover" />
            <figcaption className="caption-box absolute bottom-3 left-3">
              {b.label}
            </figcaption>
          </figure>
        ))}
      </div>

      <section id="episodes" className="mt-14">
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
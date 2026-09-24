import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { EpisodeCard } from "@/components/episode-card";
import { HostPortrait } from "@/components/host-portrait";
import { LivePlayer } from "@/components/live-player";
import { Button } from "@/components/ui/button";
import { beats, hosts, publishedEpisodes, show, upcomingEpisodes } from "@/data/show";

export const Route = createFileRoute("/podcast/")({ component: PodcastPage });

function PodcastPage() {
  const live = publishedEpisodes.length > 0;
  const queued = upcomingEpisodes.length > 0;

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
        <img
          src="/images/cover-splash.webp"
          alt="SpaceBat flying in orbit."
          className="aspect-video w-full object-cover object-top md:aspect-auto md:min-h-72 md:border-r-4 md:border-ink"
        />
        <div className="flex flex-col justify-center bg-paper p-6 sm:p-10">
          <span className="burst w-fit text-sm">Live</span>
          <h2 className="mt-4 font-display text-4xl tracking-wide">On the air</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            The SpaceBat Show, live from Podhome. Hit play on this page. If
            the booth is quiet, they’re between shows — recorded episodes land
            here as they publish.
          </p>
          <LivePlayer />
          <Button asChild className="mt-6 w-fit">
            <a href={show.liveStream} target="_blank" rel="noreferrer">
              Open the stream
              <ArrowUpRight className="size-4" />
            </a>
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

      {live ? (
        <div className="mt-10 grid gap-5">
          {publishedEpisodes.map((ep, i) => (
            <EpisodeCard key={ep.slug} episode={ep} featured={i === 0} />
          ))}
        </div>
      ) : null}

      {queued ? (
        <>
          <h2 className={`${live ? "mt-14" : "mt-12"} font-display text-4xl tracking-wide`}>
            Coming up
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEpisodes.map((ep) => (
              <EpisodeCard key={ep.slug} episode={ep} />
            ))}
          </div>
        </>
      ) : null}

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
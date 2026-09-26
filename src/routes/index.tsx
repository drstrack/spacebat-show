import { createFileRoute, Link } from "@tanstack/react-router";
import { HostPortrait } from "@/components/host-portrait";
import { LivePlayer } from "@/components/live-player";
import { Button } from "@/components/ui/button";
import { beats, hosts, show } from "@/data/show";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div>
      <header className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div className="panel overflow-hidden">
          <div className="relative">
            <img
              src="/images/cover-splash.webp"
              alt="SpaceBat the mascot — a bat in a foam cape over a climbing shuttle."
              className="aspect-[2/1] w-full object-cover object-[center_35%] sm:aspect-[2.1/1]"
            />
            <span className="burst absolute right-3 top-3 text-sm sm:right-5 sm:top-5">
              Hold on.
            </span>
          </div>
          <div className="border-t-4 border-ink bg-paper p-5 sm:p-8">
            <span className="caption-box">A podcast</span>
            <p className="mt-4 max-w-3xl font-display text-3xl leading-none tracking-wide text-ink sm:text-5xl">
              {show.lede}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/podcast" hash="live">
                  The Podcast
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/story">Why the name</Link>
              </Button>
            </div>
            <LivePlayer />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="caption-box">The diner menu</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide sm:text-5xl">
              Five beats
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            If it made them argue over coffee, it belongs on the show. SpaceBat
            is the mascot. The range is the point.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {beats.map((b) => (
            <Link
              key={b.label}
              to="/podcast"
              className="panel group relative block aspect-[3/4] overflow-hidden"
            >
              <img
                src={b.cover}
                alt=""
                className="h-full w-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
              />
              <span className="caption-box absolute bottom-3 left-3">{b.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="panel overflow-hidden bg-surface md:grid md:grid-cols-2">
          <figure className="relative min-h-72">
            <img
              src="/images/spacebat-closeup.webp"
              alt="NASA still of the free-tailed bat on Discovery’s orange tank."
              className="h-full w-full object-cover md:border-r-4 md:border-ink"
            />
            <figcaption className="absolute bottom-3 left-3 caption-box text-sm">
              NASA · STS-119
            </figcaption>
          </figure>
          <div className="flex flex-col justify-center bg-paper p-6 sm:p-10">
            <span className="caption-box w-fit">The name</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide">
              A bat that wouldn’t let go.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              March 15, 2009. A Florida free-tailed bat rode Discovery off Pad
              39A. NASA hoped he would wake and leave. He did not. We stole
              the name. We even drew him a cape. That’s the joke — not the
              episode list.
            </p>
            <Button asChild className="mt-8 w-fit" variant="secondary">
              <Link to="/story">The real one, and the wink</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="caption-box">The booth</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide">
              John and Dan.
            </h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/hosts">Full bios</Link>
          </Button>
        </div>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Friends and former colleagues. Episodes land on the podcast page
          when they publish.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <CrewPanel
            host={hosts.john}
            note="Goldman Sachs. Comics, movies, politics, and whatever just broke on the tape."
          />
          <CrewPanel
            host={hosts.dan}
            note="Eagle Scout. COO, AMYNA. Project Veritas — the search for truth."
          />
        </div>
      </section>
    </div>
  );
}

function CrewPanel({
  host,
  note,
}: {
  host: (typeof hosts)["dan"];
  note: string;
}) {
  return (
    <article className="panel overflow-hidden bg-surface">
      <Link to="/hosts" className="block">
        <HostPortrait host={host} />
      </Link>
      <div className="border-t-4 border-ink bg-paper p-5 sm:p-6">
        <p className="font-display text-sm tracking-wide text-crimson">
          {host.role} · {host.location}
        </p>
        <h3 className="mt-1 font-display text-3xl tracking-wide">{host.name}</h3>
        {host.xHandle ? (
          <p className="mt-1 font-display text-lg tracking-wide">
            <a
              href={`https://x.com/${host.xHandle}`}
              target="_blank"
              rel="noreferrer"
              className="text-crimson hover:underline"
            >
              @{host.xHandle}
            </a>
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>
      </div>
    </article>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { HostPortrait } from "@/components/host-portrait";
import { Button } from "@/components/ui/button";
import { hosts } from "@/data/show";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hosts")({ component: HostsPage });

function HostsPage() {
  return (
    <div>
      <header className="mx-auto max-w-6xl px-4 pb-4 pt-10 sm:px-6">
        <span className="caption-box">The crew</span>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-none tracking-wide sm:text-6xl">
          Two lives. One booth.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Friends and former colleagues. The show is comics, movies,
          technology, politics, and markets. The bat on the cover is a wink.
        </p>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 overflow-x-hidden px-4 pb-8 sm:px-6 md:grid-cols-2 md:overflow-visible">
        <HostCard host={hosts.john} tilt="md:-rotate-1" />
        <HostCard host={hosts.dan} tilt="md:rotate-1" />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="panel overflow-hidden bg-surface md:grid md:grid-cols-2">
          <img
            src="/images/studio.webp"
            alt="Empty diner booth with two microphones, a stack of comics, and wine."
            className="h-full min-h-64 w-full object-cover md:border-r-4 md:border-ink"
          />
          <div className="flex flex-col justify-center bg-paper p-6 sm:p-10">
            <span className="caption-box w-fit">The booth</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide">The podcast</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Comics, movies, technology, politics, and markets. SpaceBat is
              the mascot — a bat that wouldn’t let go. Episodes post when they
              publish.
            </p>
            <Button asChild className="mt-8 w-fit">
              <Link to="/podcast">Open the podcast</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function HostCard({
  host,
  tilt,
}: {
  host: (typeof hosts)["dan"];
  tilt: string;
}) {
  const chips = host.xBio
    ? host.xBio.split("|").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <article className={cn("panel overflow-hidden bg-surface", tilt)}>
      <HostPortrait host={host} />
      <div className="border-t-4 border-ink bg-paper p-6 sm:p-8">
        <p className="font-display text-sm tracking-wide text-crimson">
          {host.role} · {host.location}
        </p>
        <h2 className="mt-1 font-display text-4xl tracking-wide">{host.name}</h2>
        <p className="mt-1 text-sm text-muted">{host.headline}</p>
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
        <p className="mt-5 text-base leading-relaxed text-muted">{host.blurb}</p>

        {host.xHandle ? (
          <aside className="panel mt-6 bg-caption p-4">
            <span className="caption-box">On X</span>
            <p className="mt-3 font-display text-xl tracking-wide">
              <a
                href={`https://x.com/${host.xHandle}`}
                target="_blank"
                rel="noreferrer"
                className="text-crimson hover:underline"
              >
                @{host.xHandle}
              </a>
            </p>
            {host.xName ? (
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink/70">
                {host.xName}
              </p>
            ) : null}
            {chips.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="border-2 border-ink bg-paper px-2 py-1 text-sm leading-snug text-ink"
                >
                  {renderMentions(chip)}
                </li>
              ))}
            </ul>
            ) : null}
            <a
              href={`https://x.com/${host.xHandle}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 font-display text-lg tracking-wide text-crimson hover:underline"
            >
              Follow
              <ArrowUpRight className="size-3.5" />
            </a>
          </aside>
        ) : null}

        <div className="mt-8">
          <span className="caption-box">Experience</span>
          <ol className="mt-4">
            {host.experience.map((job) => (
              <li
                key={`${job.org}-${job.title}-${job.dates}`}
                className="border-t-2 border-ink/20 py-3 first:border-t-0 first:pt-0"
              >
                <p className="font-display text-xl tracking-wide text-ink">
                  {job.title}
                </p>
                {job.org && job.org !== job.title ? (
                  <p className="text-sm text-muted">
                    {job.org}
                    {job.dates ? ` · ${job.dates}` : ""}
                  </p>
                ) : job.dates ? (
                  <p className="text-sm text-muted">{job.dates}</p>
                ) : null}
                {job.detail ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {job.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {host.education.length > 0 ? (
          <div className="mt-8">
            <span className="caption-box">Education</span>
            <ul className="mt-4">
              {host.education.map((ed) => (
                <li
                  key={ed.school}
                  className="border-t-2 border-ink/20 py-3 first:border-t-0 first:pt-0"
                >
                  <p className="font-display text-xl tracking-wide text-ink">
                    {ed.school}
                  </p>
                  <p className="text-sm text-muted">
                    {ed.degree}
                    {ed.dates ? ` · ${ed.dates}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-4">
          {host.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-display text-lg tracking-wide text-crimson hover:underline"
            >
              {l.label}
              <ArrowUpRight className="size-3.5" />
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

function renderMentions(text: string) {
  return text.split(/(@[A-Za-z0-9_]+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <a
        key={`${part}-${i}`}
        href={`https://x.com/${part.slice(1)}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-crimson hover:underline"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

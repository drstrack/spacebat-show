import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRef } from "react";
import { loadEpisodeChapters, loadPublishedEpisodes } from "@/lib/podcast-feed.functions";
import type { EpisodeChapter, EpisodeClip } from "@/data/show";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/podcast/$slug")({
  loader: async ({ params }) => {
    const episodes = await loadPublishedEpisodes();
    const episode = episodes.find((item) => item.slug === params.slug);
    if (!episode) throw notFound();
    const chapters = episode.chaptersUrl ? await loadEpisodeChapters({ data: episode.slug }) : [];
    return {
      episode,
      chapters,
      others: episodes.filter((item) => item.slug !== episode.slug).slice(0, 4),
    };
  },
  component: EpisodePage,
});

function EpisodePage() {
  const { episode, chapters, others } = Route.useLoaderData();
  const audioRef = useRef<HTMLAudioElement>(null);

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    void audio.play().catch(() => {});
  }

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
      {episode.listenUrl ? (
        <audio
          ref={audioRef}
          controls
          preload="none"
          src={episode.listenUrl}
          className="mt-6 w-full"
        />
      ) : null}
      {episode.pageUrl ? (
        <p className="mt-3 text-sm">
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
      <div className="mt-8 space-y-4 text-base leading-relaxed text-muted">
        {episode.notes.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>

      {chapters.length > 0 ? (
        <section id="chapters" className="mt-10 scroll-mt-24">
          <span className="caption-box">Chapters</span>
          <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
            {chapters.map((chapter) => (
              <li key={`${chapter.start}-${chapter.title}`}>
                <ChapterRow chapter={chapter} onSeek={seek} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {episode.clips.length > 0 ? (
        <section id="clips" className="mt-10 scroll-mt-24">
          <span className="caption-box">Clips</span>
          <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
            {episode.clips.map((clip) => (
              <li key={`${clip.start}-${clip.duration}`}>
                <ClipRow clip={clip} onSeek={seek} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {episode.notes.links.length > 0 ? (
        <section id="notes" className="mt-10 scroll-mt-24">
          <span className="caption-box">Show notes</span>
          <ul className="mt-4 divide-y-2 divide-ink border-y-4 border-ink">
            {episode.notes.links.map((link) => (
              <li key={link.href} className="py-3">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-xl tracking-wide text-crimson underline"
                >
                  {link.label}
                </a>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-sm text-ink underline"
                >
                  {link.href}
                </a>
              </li>
            ))}
          </ul>
        </section>
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

function ChapterRow({
  chapter,
  onSeek,
}: {
  chapter: EpisodeChapter;
  onSeek: (seconds: number) => void;
}) {
  return (
    <div className="flex items-baseline gap-4 py-3">
      <button
        type="button"
        onClick={() => onSeek(chapter.start)}
        className="flex min-w-0 flex-1 items-baseline gap-4 text-left"
      >
        <span className="w-16 shrink-0 font-display text-lg tracking-wide text-crimson">
          {clock(chapter.start)}
        </span>
        <span className="font-display text-xl tracking-wide text-ink">{chapter.title}</span>
      </button>
      {chapter.url ? (
        <a
          href={chapter.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm text-crimson underline"
        >
          Link
        </a>
      ) : null}
    </div>
  );
}

function ClipRow({ clip, onSeek }: { clip: EpisodeClip; onSeek: (seconds: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSeek(clip.start)}
      className="block w-full py-3 text-left"
    >
      <span className="font-display text-lg tracking-wide text-crimson">
        {clock(clip.start)}
        {clip.duration > 0 ? (
          <span className="ml-3 text-sm tracking-wide text-ink/60">{clock(clip.duration)}</span>
        ) : null}
      </span>
      {clip.title ? (
        <span className="mt-1 block font-display text-xl tracking-wide text-ink">{clip.title}</span>
      ) : null}
      {clip.text ? <span className="mt-1 block text-sm leading-relaxed text-muted">{clip.text}</span> : null}
    </button>
  );
}

function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const ss = String(secs).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}
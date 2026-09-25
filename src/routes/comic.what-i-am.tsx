import { createFileRoute, Link } from "@tanstack/react-router";
import { chapterOne, type ComicBeat } from "@/data/comic";

export const Route = createFileRoute("/comic/what-i-am")({
  component: ChapterOne,
});

function ChapterOne() {
  return (
    <article className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link
        to="/comic"
        className="font-display text-lg tracking-wide text-crimson hover:underline"
      >
        The rack
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="burst">Issue {chapterOne.code}</span>
        <span className="text-xs uppercase tracking-[0.14em] text-muted">{chapterOne.when}</span>
      </div>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">{chapterOne.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{chapterOne.dek}</p>

      <ol className="mt-10 space-y-8">
        {chapterOne.panels.map((panel, index) => (
          <li key={panel.id}>
            <figure className="panel overflow-hidden bg-paper">
              <img src={panel.image} alt={panel.alt} className="aspect-[3/4] w-full object-cover" />
              <figcaption className="space-y-3 border-t-4 border-ink p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">
                  {String(index + 1).padStart(2, "0")}
                </p>
                {panel.beats.map((beat, beatIndex) => (
                  <Beat key={`${panel.id}-${beatIndex}`} beat={beat} />
                ))}
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </article>
  );
}

function Beat({ beat }: { beat: ComicBeat }) {
  if (beat.kind === "speech") {
    return (
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">{beat.speaker}</p>
        <p className="relative mt-1 max-w-sm rounded-[1.6rem] border-4 border-ink bg-white px-4 py-3 font-display text-xl leading-tight tracking-wide text-ink">
          {beat.text}
        </p>
      </div>
    );
  }
  return <p className="caption-box block w-full text-lg leading-snug">{beat.text}</p>;
}

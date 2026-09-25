import { createFileRoute, Link } from "@tanstack/react-router";
import { chapterOne } from "@/data/comic";

export const Route = createFileRoute("/comic/what-i-am")({
  component: ChapterOne,
});

function ChapterOne() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
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

      <ol className="mt-10 space-y-6">
        {chapterOne.panels.map((panel, index) => (
          <li key={panel.id}>
            <figure className="panel relative overflow-hidden bg-ink">
              <img
                src={panel.image}
                alt={panel.alt}
                className="aspect-[3/4] w-full object-cover"
              />
              <p className="absolute right-3 top-3 border-2 border-ink bg-paper px-1.5 py-0.5 font-display text-sm tracking-wide text-ink">
                {String(index + 1).padStart(2, "0")}
              </p>
              {panel.speech ? (
                <div
                  className={
                    panel.speech.place === "lower-left"
                      ? "absolute bottom-4 left-3 max-w-[16rem]"
                      : "absolute left-3 right-12 top-[14%] max-w-sm"
                  }
                >
                  {panel.speech.speaker ? (
                    <p className="mb-1 inline-block bg-ink px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-caption">
                      {panel.speech.speaker}
                    </p>
                  ) : null}
                  <p className="rounded-[1.5rem] border-4 border-ink bg-white px-4 py-3 font-display text-xl leading-tight tracking-wide text-ink shadow-[4px_4px_0_0_#141414]">
                    {panel.speech.text}
                  </p>
                </div>
              ) : null}
              {panel.thoughts.length > 0 ? (
                <figcaption className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 bg-gradient-to-t from-ink/80 via-ink/40 to-transparent p-3 pt-16">
                  {panel.thoughts.map((thought) => (
                    <p
                      key={thought}
                      className="caption-box block w-fit max-w-full text-base leading-snug sm:text-lg"
                    >
                      {thought}
                    </p>
                  ))}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ol>
    </article>
  );
}

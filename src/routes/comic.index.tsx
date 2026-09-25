import { createFileRoute, Link } from "@tanstack/react-router";
import { chapterOne, issueTwo } from "@/data/comic";
import { loadPublishedEpisodes } from "@/lib/podcast-feed.functions";

export const Route = createFileRoute("/comic/")({
  loader: () => loadPublishedEpisodes(),
  component: ComicCatalog,
});

function ComicCatalog() {
  const episodes = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <span className="caption-box">The rack</span>
      <h1 className="mt-4 font-display text-5xl tracking-wide">The comic</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Present day, 2026. Seventeen years after he came back changed. The
        record of the name stays on its own page. This is the wink.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <article className="panel overflow-hidden bg-paper">
          <Link to="/comic/what-i-am" className="block">
            <img
              src={chapterOne.cover}
              alt=""
              className="aspect-[3/4] w-full border-b-4 border-ink object-cover"
            />
          </Link>
          <div className="p-5">
            <span className="burst text-sm">Issue {chapterOne.code}</span>
            <h2 className="mt-4 font-display text-4xl tracking-wide">
              <Link to="/comic/what-i-am">{chapterOne.title}</Link>
            </h2>
            <p className="mt-2 text-sm text-muted">{chapterOne.when}</p>
            <p className="mt-3 text-base leading-relaxed text-muted">{chapterOne.dek}</p>
            <Link
              to="/comic/what-i-am"
              className="mt-4 inline-block font-display text-lg tracking-wide text-crimson hover:underline"
            >
              Read chapter one
            </Link>
          </div>
        </article>

        <article className="panel flex flex-col bg-paper p-5">
          <span className="burst text-sm">Issue {issueTwo.code}</span>
          <h2 className="mt-4 font-display text-4xl tracking-wide">{issueTwo.title}</h2>
          <p className="mt-6 font-display text-3xl leading-none tracking-wide">{issueTwo.note}</p>
        </article>
      </div>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
        <span className="font-display tracking-wide text-ink">Note. </span>
        {chapterOne.footnote}
      </p>

      <section className="mt-16">
        <span className="caption-box">The shelf</span>
        <h2 className="mt-4 font-display text-4xl tracking-wide">From the podcast</h2>
        {episodes.length > 0 ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {episodes.map((episode) => (
              <li key={episode.slug} className="panel flex gap-4 bg-paper p-3">
                <Link
                  to="/podcast/$slug"
                  params={{ slug: episode.slug }}
                  className="block shrink-0"
                >
                  <img
                    src={episode.cover}
                    alt=""
                    className="size-28 border-4 border-ink object-cover"
                  />
                </Link>
                <div className="min-w-0 py-1">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">
                    Episode {episode.code}
                    {episode.dateLabel ? ` · ${episode.dateLabel}` : ""}
                  </p>
                  <Link
                    to="/podcast/$slug"
                    params={{ slug: episode.slug }}
                    className="mt-1 block font-display text-2xl leading-none tracking-wide hover:text-crimson"
                  >
                    {episode.title}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel mt-6 bg-paper px-4 py-6 text-center font-display text-2xl tracking-wide">
            No Episodes posted yet
          </p>
        )}
      </section>
    </div>
  );
}

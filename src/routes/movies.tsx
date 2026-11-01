import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, type KeyboardEvent } from "react";
import {
  MEDIA_DESCRIPTION,
  MEDIA_OG_IMAGE,
  MEDIA_PAGE_HEAD,
  MEDIA_PAGE_TITLE,
  MEDIA_URL,
  mediaByKind,
  mediaTabLabel,
  renderMediaGrid,
} from "@/lib/media";

type MediaTab = "movies" | "tv";

export const Route = createFileRoute("/movies")({
  validateSearch: (search: Record<string, unknown>): { tab?: "tv" } => ({
    tab: search.tab === "tv" ? "tv" : undefined,
  }),
  head: () => ({
    meta: [
      { title: MEDIA_PAGE_HEAD },
      { name: "description", content: MEDIA_DESCRIPTION },
      { name: "spacebat:og-title", content: MEDIA_PAGE_HEAD },
      { name: "spacebat:og-description", content: MEDIA_DESCRIPTION },
      { name: "spacebat:og-image", content: MEDIA_OG_IMAGE },
      { name: "spacebat:og-image:width", content: "1200" },
      { name: "spacebat:og-image:height", content: "630" },
      { name: "spacebat:og-url", content: MEDIA_URL },
    ],
  }),
  component: MoviesPage,
});

function MoviesPage() {
  const tab: MediaTab = Route.useSearch().tab === "tv" ? "tv" : "movies";
  const navigate = useNavigate();
  const movies = mediaByKind("movie");
  const shows = mediaByKind("tv");

  const selectTab = useCallback(
    (next: MediaTab) => {
      void navigate({
        to: "/movies",
        search: next === "tv" ? { tab: "tv" } : {},
        resetScroll: false,
      });
      requestAnimationFrame(() => {
        document.getElementById(`media-tab-${next}`)?.focus();
      });
    },
    [navigate],
  );

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const order: MediaTab[] = ["movies", "tv"];
    const index = order.indexOf(tab);
    let next: MediaTab | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = order[(index + 1) % order.length] ?? tab;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = order[(index - 1 + order.length) % order.length] ?? tab;
    else if (event.key === "Home") next = "movies";
    else if (event.key === "End") next = "tv";
    if (!next || next === tab) return;
    event.preventDefault();
    selectTab(next);
  }

  return (
    <article>
      <header className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div className="panel bg-paper p-6 sm:p-10">
          <span className="caption-box w-fit">The booth</span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-none tracking-wide sm:text-6xl">
            {MEDIA_PAGE_TITLE}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{MEDIA_DESCRIPTION}</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div
          role="tablist"
          aria-label="Movies and TV"
          className="flex gap-2"
          onKeyDown={onTabKey}
        >
          <TabLink kind="movies" active={tab === "movies"} label={mediaTabLabel("movies")} />
          <TabLink kind="tv" active={tab === "tv"} label={mediaTabLabel("tv")} />
        </div>
      </div>

      <MediaPanel kind="movies" active={tab === "movies"} html={renderMediaGrid(movies)} />
      <MediaPanel kind="tv" active={tab === "tv"} html={renderMediaGrid(shows)} />

      <footer className="mx-auto max-w-6xl px-3 pb-12 pt-2 sm:px-5">
        <p className="text-sm leading-relaxed text-muted">
          Posters and logos © their respective studios and networks, shown for commentary and
          identification. Want one removed? Email{" "}
          <a className="text-crimson underline underline-offset-2" href="mailto:spacebatshow@gmail.com">
            spacebatshow@gmail.com
          </a>
          .
        </p>
      </footer>
    </article>
  );
}

function TabLink({
  kind,
  active,
  label,
}: {
  kind: MediaTab;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      to="/movies"
      search={kind === "tv" ? { tab: "tv" } : {}}
      role="tab"
      id={`media-tab-${kind}`}
      aria-selected={active}
      aria-controls={`media-panel-${kind}`}
      tabIndex={active ? 0 : -1}
      className={
        active
          ? "inline-flex min-h-11 flex-1 items-center justify-center border-4 border-ink bg-crimson px-3 py-3 text-center font-display text-xl tracking-wide text-crimson-fg shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          : "inline-flex min-h-11 flex-1 items-center justify-center border-4 border-ink bg-paper px-3 py-3 text-center font-display text-xl tracking-wide text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      }
    >
      {label}
    </Link>
  );
}

function MediaPanel({ kind, active, html }: { kind: MediaTab; active: boolean; html: string }) {
  return (
    <section
      role="tabpanel"
      id={`media-panel-${kind}`}
      aria-labelledby={`media-tab-${kind}`}
      hidden={!active}
      className="mx-auto max-w-6xl px-3 py-6 sm:px-5"
    >
      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

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
  type MediaSort,
} from "@/lib/media";
import { loadMovies } from "@/lib/media.functions";

type MediaTab = "movies" | "tv";
type MoviesSearch = { tab?: "tv"; sort?: "john" | "dan" };

function moviesSearch(tab: MediaTab, sort: MediaSort): MoviesSearch {
  const search: MoviesSearch = {};
  if (tab === "tv") search.tab = "tv";
  if (sort === "john" || sort === "dan") search.sort = sort;
  return search;
}

export const Route = createFileRoute("/movies")({
  validateSearch: (search: Record<string, unknown>): MoviesSearch => ({
    tab: search.tab === "tv" ? "tv" : undefined,
    sort: search.sort === "john" || search.sort === "dan" ? search.sort : undefined,
  }),
  loader: () => loadMovies(),
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
  const { tab: tabSearch, sort: sortSearch } = Route.useSearch();
  const tab: MediaTab = tabSearch === "tv" ? "tv" : "movies";
  const sort: MediaSort = sortSearch === "john" || sortSearch === "dan" ? sortSearch : "newest";
  const { items, canManage } = Route.useLoaderData();
  const navigate = useNavigate();
  const movies = mediaByKind("movie", items, sort);
  const shows = mediaByKind("tv", items, sort);

  const selectTab = useCallback(
    (next: MediaTab) => {
      void navigate({
        to: "/movies",
        search: moviesSearch(next, sort),
        resetScroll: false,
      });
      requestAnimationFrame(() => {
        document.getElementById(`media-tab-${next}`)?.focus();
      });
    },
    [navigate, sort],
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
          {canManage ? (
            <p className="mt-4">
              <Link to="/admin/movies" className="font-display text-xl tracking-wide text-crimson hover:underline">
                Edit movies & TV
              </Link>
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div role="tablist" aria-label="Movies and TV" className="flex gap-2" onKeyDown={onTabKey}>
          <TabLink kind="movies" active={tab === "movies"} label={mediaTabLabel("movies", items)} sort={sort} />
          <TabLink kind="tv" active={tab === "tv"} label={mediaTabLabel("tv", items)} sort={sort} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Sort">
          <SortLink tab={tab} sort={sort} value="newest" label="Newest mention" />
          <SortLink tab={tab} sort={sort} value="john" label="John's rating" />
          <SortLink tab={tab} sort={sort} value="dan" label="Dan's rating" />
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
        <p className="mt-4 flex flex-wrap items-center gap-3 text-sm leading-relaxed text-muted">
          <img src="/tmdb-logo.svg" alt="TMDB" width={154} height={20} />
          <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </p>
      </footer>
    </article>
  );
}

function TabLink({
  kind,
  active,
  label,
  sort,
}: {
  kind: MediaTab;
  active: boolean;
  label: string;
  sort: MediaSort;
}) {
  return (
    <Link
      to="/movies"
      search={moviesSearch(kind, sort)}
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

function SortLink({
  tab,
  sort,
  value,
  label,
}: {
  tab: MediaTab;
  sort: MediaSort;
  value: MediaSort;
  label: string;
}) {
  const active = sort === value;
  return (
    <Link
      to="/movies"
      search={moviesSearch(tab, value)}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "inline-flex min-h-11 items-center border-4 border-ink bg-caption px-3 font-display text-lg tracking-wide"
          : "inline-flex min-h-11 items-center border-4 border-ink bg-paper px-3 font-display text-lg tracking-wide"
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

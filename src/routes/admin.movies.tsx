import { upload } from "@vercel/blob/client";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import { classifyUpload } from "@/lib/chat/uploads";
import {
  episodeLines,
  MEDIA_RATING_LABEL,
  formatRating,
  mediaBlobPathname,
  holdVisibleIds,
  idsForRatingView,
  mediaPicture,
  nextHostRating,
  orderForRater,
  ratingViewCount,
  type RatingView,
  type MediaEntry,
  type MediaHost,
  type MediaRatingChoice,
} from "@/lib/media";
import type { TmdbHit } from "@/lib/tmdb";
import {
  applyTmdbMatch,
  deleteMovie,
  loadMovies,
  lookupTmdbTitle,
  matchAllTmdb,
  rateMovie,
  refreshTmdbTitle,
  saveMovie,
  searchTmdbTitles,
} from "@/lib/media.functions";

export const Route = createFileRoute("/admin/movies")({
  loader: () => loadMovies(),
  staleTime: 0,
  component: AdminMoviesPage,
});

const EMPTY = {
  id: "",
  kind: "movie" as "movie" | "tv",
  title: "",
  year: "",
  wikipediaUrl: "",
  image: "",
  imageCredit: "",
  imageKind: "poster" as "poster" | "logo" | "still",
  bestGuess: false,
  bestGuessReason: "",
  episodesText: "",
  overview: "",
  tmdbId: "",
  tmdbType: "" as "" | "movie" | "tv",
  imdbId: "",
  posterPath: "",
};

function AdminMoviesPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<MediaEntry | null>(null);
  const [hits, setHits] = useState<TmdbHit[]>([]);
  const [tmdbNote, setTmdbNote] = useState("");
  const [proposals, setProposals] = useState<
    { id: string; title: string; bestGuess: boolean; proposal: TmdbHit | null }[] | null
  >(null);
  const [formOpen, setFormOpen] = useState(false);
  const [ratingOverride, setRatingOverride] = useState<Record<string, MediaRatingChoice>>({});
  const [ratingStatus, setRatingStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const pinnedIds = useRef<string[] | null>(null);
  const viewIds = useRef<string[] | null>(null);
  const [ratingView, setRatingView] = useState<RatingView>("unrated");
  const [orderVersion, setOrderVersion] = useState(0);
  const pendingCount = Object.keys(ratingOverride).filter((key) => {
    const [who, id] = key.split(":");
    const item = data.items.find((row) => row.id === id);
    if (!item || (who !== "john" && who !== "dan")) return false;
    return ratingOverride[key] !== item.ratings[who];
  }).length;

  useEffect(() => {
    if (pendingCount === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingCount]);

  if (!data.canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Crew only</h1>
        <p className="mt-3 text-sm text-muted">Sign in as an admin to edit movies and TV.</p>
        <Link to="/login" className="mt-6 inline-block font-display text-xl text-crimson hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const host: MediaHost | null =
    data.viewerHost === "john" || data.viewerHost === "dan" ? data.viewerHost : null;

  function edit(item: MediaEntry) {
    setError("");
    setForm({
      id: item.id,
      kind: item.kind,
      title: item.title,
      year: item.year,
      wikipediaUrl: item.wikipedia_url,
      image: item.image ?? "",
      imageCredit: item.image_credit ?? "",
      imageKind: item.image_kind ?? "poster",
      bestGuess: item.best_guess,
      bestGuessReason: item.best_guess_reason ?? "",
      episodesText: episodeLines(item.episodes),
      overview: item.overview ?? "",
      tmdbId: item.tmdbId ? String(item.tmdbId) : "",
      tmdbType: item.tmdbType ?? "",
      imdbId: item.imdbId ?? "",
      posterPath: item.posterPath ?? "",
    });
    setHits([]);
    setTmdbNote("");
    setFormOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy("save");
    try {
      await saveMovie({
        data: {
          id: form.id || undefined,
          draft: {
            kind: form.kind,
            title: form.title,
            year: form.year,
            wikipediaUrl: form.wikipediaUrl,
            image: form.image,
            imageCredit: form.imageCredit,
            imageKind: form.imageKind,
            bestGuess: form.bestGuess,
            bestGuessReason: form.bestGuessReason,
            episodesText: form.episodesText,
            overview: form.overview,
            tmdbId: form.tmdbId ? Number(form.tmdbId) : null,
            tmdbType: form.tmdbType || null,
            imdbId: form.imdbId,
            posterPath: form.posterPath,
          },
        },
      });
      setForm(EMPTY);
      setHits([]);
      setFormOpen(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t save.");
    } finally {
      setBusy("");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const classified = classifyUpload(file.name, file.type, file.size);
    if (!classified.ok || classified.kind !== "image") {
      setError(classified.ok ? "That file type isn't allowed." : classified.error);
      return;
    }
    setBusy("upload");
    try {
      const token = getBearerToken();
      const blob = await upload(mediaBlobPathname(file.name), file, {
        access: "public",
        handleUploadUrl: "/api/media/upload",
        contentType: classified.contentType,
        clientPayload: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setForm((current) => ({ ...current, image: blob.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that picture. Paste an image URL instead.");
    } finally {
      setBusy("");
    }
  }

  function fillFromHit(hit: TmdbHit) {
    setForm((current) => ({
      ...current,
      title: hit.title,
      year: hit.year || current.year,
      kind: hit.tmdbType,
      overview: hit.overview,
      tmdbId: String(hit.tmdbId),
      tmdbType: hit.tmdbType,
      imdbId: hit.imdbId ?? "",
      posterPath: hit.posterPath ?? "",
    }));
  }

  async function onFind() {
    setError("");
    setTmdbNote("");
    setBusy("tmdb");
    try {
      const found = await searchTmdbTitles({
        data: { title: form.title, year: form.year, kind: form.kind },
      });
      if (!found.configured) {
        setHits([]);
        setTmdbNote(found.error);
        return;
      }
      setHits(found.results);
      setTmdbNote(found.results.length ? "" : "No TMDB matches.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "TMDB search failed.");
    } finally {
      setBusy("");
    }
  }

  async function onPick(hit: TmdbHit) {
    setBusy("tmdb");
    setError("");
    try {
      const detail = await lookupTmdbTitle({ data: { tmdbId: hit.tmdbId, tmdbType: hit.tmdbType } });
      fillFromHit(detail.configured && detail.results ? detail.results : hit);
      setHits([]);
      setTmdbNote(detail.configured ? "" : detail.error);
    } catch (err) {
      fillFromHit(hit);
      setError(err instanceof Error ? err.message : "TMDB didn't return that title.");
    } finally {
      setBusy("");
    }
  }

  async function onRefresh(id: string) {
    setError("");
    setBusy(id);
    try {
      await refreshTmdbTitle({ data: { id } });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "TMDB refresh failed.");
    } finally {
      setBusy("");
    }
  }

  async function onMatchAll() {
    setError("");
    setBusy("match");
    try {
      const found = await matchAllTmdb();
      if (!found.configured) {
        setProposals(null);
        setTmdbNote(found.error);
        return;
      }
      setProposals(found.results);
      setTmdbNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "TMDB match failed.");
    } finally {
      setBusy("");
    }
  }

  async function onApply(id: string, hit: TmdbHit) {
    setBusy(id);
    setError("");
    try {
      await applyTmdbMatch({ data: { id, tmdbId: hit.tmdbId, tmdbType: hit.tmdbType } });
      setProposals((current) => current?.filter((row) => row.id !== id) ?? null);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That match didn’t save.");
    } finally {
      setBusy("");
    }
  }

  function shownRating(item: MediaEntry, who: MediaHost): MediaRatingChoice {
    return ratingOverride[`${who}:${item.id}`] ?? item.ratings[who];
  }

  function refreshOrder() {
    const viewed = data.items.map((item) =>
      host ? { ...item, ratings: { ...item.ratings, [host]: shownRating(item, host) } } : item,
    );
    const nextOrder = orderForRater(viewed, host).map((item) => item.id);
    pinnedIds.current = nextOrder;
    const visible = new Set(viewIds.current ?? nextOrder);
    viewIds.current = nextOrder.filter((id) => visible.has(id));
    setOrderVersion((version) => version + 1);
  }

  function isPending(item: MediaEntry): boolean {
    if (!host) return false;
    const choice = ratingOverride[`${host}:${item.id}`];
    return choice != null && choice !== item.ratings[host];
  }

  function cycleRating(item: MediaEntry) {
    if (!host) return;
    const current = shownRating(item, host);
    const next = nextHostRating(current);
    const key = `${host}:${item.id}`;
    setRatingOverride((prev) => ({ ...prev, [key]: next }));
    setRatingStatus((prev) => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });
  }

  function cancelRating(item: MediaEntry) {
    if (!host) return;
    const key = `${host}:${item.id}`;
    setRatingOverride((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setRatingStatus((prev) => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });
  }

  function discardChanges() {
    const pendingIds = new Set(data.items.filter((item) => isPending(item)).map((item) => item.id));
    setRatingOverride({});
    setRatingStatus((prev) => {
      const copy = { ...prev };
      for (const id of pendingIds) delete copy[id];
      return copy;
    });
  }

  async function saveAllRatings() {
    if (!host) return;
    const waiting = data.items.filter((item) => isPending(item));
    if (waiting.length === 0) return;
    const planned = waiting.map((item) => ({
      id: item.id,
      rating: shownRating(item, host),
      key: `${host}:${item.id}`,
    }));
    setRatingStatus((prev) => {
      const copy = { ...prev };
      for (const row of planned) copy[row.id] = "saving";
      return copy;
    });
    try {
      await Promise.all(planned.map((row) => rateMovie({ data: { id: row.id, rating: row.rating } })));
      await router.invalidate();
      setRatingOverride((prev) => {
        const copy = { ...prev };
        for (const row of planned) {
          if (copy[row.key] === row.rating) delete copy[row.key];
        }
        return copy;
      });
      setRatingStatus((prev) => {
        const copy = { ...prev };
        for (const row of planned) copy[row.id] = "saved";
        return copy;
      });
    } catch (err) {
      setRatingStatus((prev) => {
        const copy = { ...prev };
        for (const row of planned) copy[row.id] = "error";
        return copy;
      });
      setError(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  function chooseView(next: RatingView) {
    setRatingView(next);
    const order = pinnedIds.current ?? data.items.map((item) => item.id);
    const allowed = new Set(host ? idsForRatingView(data.items, host, next) : order);
    viewIds.current = order.filter((id) => allowed.has(id));
    setOrderVersion((version) => version + 1);
  }

  async function confirmDelete() {
    if (!pending) return;
    setBusy(pending.id);
    setError("");
    try {
      await deleteMovie({ data: { id: pending.id } });
      if (form.id === pending.id) setForm(EMPTY);
      setPending(null);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t delete.");
    } finally {
      setBusy("");
    }
  }

  if (pinnedIds.current === null && data.items.length > 0) {
    pinnedIds.current = orderForRater(data.items, host).map((item) => item.id);
  }
  if (viewIds.current === null && pinnedIds.current) {
    const allowed = new Set(host ? idsForRatingView(data.items, host, ratingView) : pinnedIds.current);
    viewIds.current = pinnedIds.current.filter((id) => allowed.has(id));
  }
  const viewedItems = data.items.map((item) =>
    host ? { ...item, ratings: { ...item.ratings, [host]: shownRating(item, host) } } : item,
  );
  const cards = holdVisibleIds(viewIds.current ?? [], viewedItems);
  void orderVersion;

  return (
    <div className={`mx-auto max-w-5xl px-4 py-12 sm:px-6 ${pendingCount > 0 ? "pb-28" : ""}`}>
      <p className="caption-box">Back end</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Movies & TV</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Add a title, fix a credit, or take one down.{" "}
        {host === "john"
          ? "You are John. You can set John’s rating only."
          : host === "dan"
            ? "You are Dan. You can set Dan’s rating only."
            : "Ratings are John’s and Dan’s. This account can edit the list and cannot set either rating."}
      </p>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/admin" className="font-display text-2xl tracking-wide text-crimson hover:underline">
          Analytics
        </Link>
        <Link to="/movies" className="font-display text-2xl tracking-wide text-crimson hover:underline">
          The public page
        </Link>
        <Button type="button" variant="secondary" disabled={busy === "match"} onClick={() => void onMatchAll()}>
          {busy === "match" ? "Matching" : "Match all from TMDB"}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            setHits([]);
            setError("");
            setFormOpen(true);
          }}
        >
          Add movie or TV show
        </Button>
      </p>
      {host ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Which titles to show">
            {(
              [
                ["unrated", `Not rated yet (${ratingViewCount(data.items, host, "unrated")})`],
                ["rated", `Rated (${ratingViewCount(data.items, host, "rated")})`],
                ["not_seen", `Haven't seen it (${ratingViewCount(data.items, host, "not_seen")})`],
                ["all", `All (${ratingViewCount(data.items, host, "all")})`],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                data-rating-view={view}
                aria-pressed={ratingView === view}
                className={`min-h-11 border-4 border-ink px-2 text-center font-display text-lg leading-tight tracking-wide sm:text-xl ${
                  ratingView === view ? "bg-crimson text-crimson-fg" : "bg-paper"
                }`}
                onClick={() => chooseView(view)}
              >
                {label}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" className="min-h-11 w-fit" onClick={() => refreshOrder()}>
            Refresh order
          </Button>
        </div>
      ) : null}
      {tmdbNote ? <p className="mt-3 text-sm text-crimson">{tmdbNote}</p> : null}
      {proposals ? (
        <ul className="mt-4 space-y-2">
          {proposals.map((row) => (
            <li key={row.id} className="border-4 border-ink bg-paper px-3 py-3 text-sm">
              <p className="font-display text-xl tracking-wide">
                {row.title}
                {row.bestGuess ? " · Best guess" : ""}
              </p>
              {row.proposal ? (
                <p className="mt-1">
                  Proposed: {row.proposal.title}
                  {row.proposal.year ? ` (${row.proposal.year})` : ""} · TMDB {row.proposal.tmdbId}
                </p>
              ) : (
                <p className="mt-1 text-muted">No TMDB match.</p>
              )}
              {row.proposal ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  disabled={busy === row.id}
                  onClick={() => void onApply(row.id, row.proposal as TmdbHit)}
                >
                  Use this match
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {formOpen ? (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/40 px-3 py-8">
      <form onSubmit={(event) => void onSave(event)} className="panel mx-auto max-w-3xl space-y-4 bg-paper p-4 sm:p-6">
        <h2 className="font-display text-3xl tracking-wide">{form.id ? "Edit title" : "Add a title"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Kind
            <select
              className="mt-1 h-12 w-full border-4 border-ink bg-ivory px-3"
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value === "tv" ? "tv" : "movie" })}
            >
              <option value="movie">Movie</option>
              <option value="tv">TV</option>
            </select>
          </label>
          <label className="block text-sm">
            Year
            <Input className="mt-1" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
          </label>
        </div>
        <label className="block text-sm">
          Title
          <Input className="mt-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" disabled={busy === "tmdb"} onClick={() => void onFind()}>
            {busy === "tmdb" ? "Searching" : "Find on TMDB"}
          </Button>
          <p className="text-sm text-muted">A custom upload still wins over the TMDB poster.</p>
        </div>
        {hits.length > 0 ? (
          <ul className="space-y-2">
            {hits.map((hit) => (
              <li key={hit.tmdbId}>
                <button
                  type="button"
                  className="w-full border-4 border-ink bg-ivory px-3 py-2 text-left text-sm"
                  onClick={() => void onPick(hit)}
                >
                  {hit.title}
                  {hit.year ? ` (${hit.year})` : ""} · {hit.tmdbType} {hit.tmdbId}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="block text-sm">
          Overview
          <textarea
            className="mt-1 min-h-20 w-full border-4 border-ink bg-ivory px-3 py-2"
            value={form.overview}
            onChange={(event) => setForm({ ...form, overview: event.target.value })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            TMDB id
            <Input className="mt-1" value={form.tmdbId} onChange={(event) => setForm({ ...form, tmdbId: event.target.value })} />
          </label>
          <label className="block text-sm">
            IMDb id
            <Input className="mt-1" value={form.imdbId} onChange={(event) => setForm({ ...form, imdbId: event.target.value })} />
          </label>
          <label className="block text-sm">
            TMDB poster path
            <Input
              className="mt-1"
              value={form.posterPath}
              onChange={(event) => setForm({ ...form, posterPath: event.target.value })}
            />
          </label>
        </div>
        <label className="block text-sm">
          Wikipedia URL
          <Input
            className="mt-1"
            value={form.wikipediaUrl}
            onChange={(event) => setForm({ ...form, wikipediaUrl: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          Image URL
          <Input
            className="mt-1"
            value={form.image}
            placeholder="Paste an https URL, or upload"
            onChange={(event) => setForm({ ...form, image: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          Upload a picture
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Image kind
            <select
              className="mt-1 h-12 w-full border-4 border-ink bg-ivory px-3"
              value={form.imageKind}
              onChange={(event) =>
                setForm({
                  ...form,
                  imageKind:
                    event.target.value === "logo" || event.target.value === "still" ? event.target.value : "poster",
                })
              }
            >
              <option value="poster">Poster</option>
              <option value="logo">Logo</option>
              <option value="still">Still</option>
            </select>
          </label>
          <label className="block text-sm">
            Studio credit
            <Input
              className="mt-1"
              value={form.imageCredit}
              onChange={(event) => setForm({ ...form, imageCredit: event.target.value })}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.bestGuess}
            onChange={(event) => setForm({ ...form, bestGuess: event.target.checked })}
          />
          Best guess
        </label>
        {form.bestGuess ? (
          <label className="block text-sm">
            Why it’s a guess
            <Input
              className="mt-1"
              value={form.bestGuessReason}
              onChange={(event) => setForm({ ...form, bestGuessReason: event.target.value })}
            />
          </label>
        ) : null}
        <label className="block text-sm">
          Episodes, one per line: slug | title | timestamp
          <textarea
            className="mt-1 min-h-28 w-full border-4 border-ink bg-ivory px-3 py-2"
            value={form.episodesText}
            onChange={(event) => setForm({ ...form, episodesText: event.target.value })}
          />
        </label>
        {error && !pending ? <p className="text-sm text-crimson">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy === "save" || busy === "upload"}>
            {busy === "upload" ? "Uploading" : busy === "save" ? "Saving" : form.id ? "Save changes" : "Add title"}
          </Button>
          {form.id ? (
            <Button type="button" variant="secondary" disabled={busy === form.id} onClick={() => void onRefresh(form.id)}>
              Refresh from TMDB
            </Button>
          ) : null}
          {form.id ? (
            <Button
              type="button"
              className="bg-crimson text-crimson-fg"
              onClick={() => {
                const item = data.items.find((row) => row.id === form.id);
                if (item) setPending(item);
              }}
            >
              Delete title
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setForm(EMPTY);
              setFormOpen(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
      </div>
      ) : null}

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-card-order={cards.map((item) => item.id).join(" ")}>
        {cards.map((item) => {
          const source = data.items.find((row) => row.id === item.id) ?? item;
          const picture = mediaPicture(item);
          const mine = host ? item.ratings[host] : null;
          const unsaved = host ? isPending(source) : false;
          const you = host === "dan" ? "Dan" : "John";
          const otherHost = host === "dan" ? "john" : "dan";
          const otherName = host === "dan" ? "John" : "Dan";
          const overlay = mine === "unrated" || mine == null ? "Not rated yet, tap to rate" : formatRating(mine);
          const poster = (
            <div className="relative">
              {picture ? (
                <img
                  src={picture.src}
                  alt=""
                  width={picture.width}
                  height={picture.height}
                  className={`aspect-[2/3] w-full object-contain ${picture.logo ? "bg-crimson" : "bg-paper"}`}
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center bg-caption px-3 text-center font-display text-2xl leading-none">
                  {item.title}
                </div>
              )}
              <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/75 px-3 text-center font-display text-2xl leading-tight tracking-wide text-paper sm:text-3xl">
                <span>{overlay}</span>
                {unsaved ? (
                  <span className="border-4 border-caption bg-crimson px-2 py-1 text-lg text-crimson-fg">Unsaved</span>
                ) : null}
              </span>
            </div>
          );
          return (
            <li
              key={item.id}
              data-media-id={item.id}
              data-pending={unsaved ? "true" : "false"}
              className={`border-4 bg-paper shadow-[4px_4px_0_0_var(--color-ink)] ${unsaved ? "border-crimson" : "border-ink"}`}
            >
              {host && mine ? (
                <button
                  type="button"
                  data-rating={mine}
                  className="block min-h-11 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
                  aria-label={`${item.title}. Your rating: ${MEDIA_RATING_LABEL[mine]}. Activate to change it.`}
                  onClick={() => cycleRating(data.items.find((row) => row.id === item.id) ?? item)}
                >
                  {poster}
                </button>
              ) : (
                poster
              )}
              <div className="space-y-1 p-2">
                <p className="font-display text-xl leading-none tracking-wide">{item.title}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-muted">
                  {item.kind === "tv" ? "TV" : "Movie"}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
                {host && mine ? <p className="text-sm">You ({you}): {formatRating(mine)}</p> : null}
                <p className="text-sm">
                  {host ? otherName : "John"}: {formatRating(host ? item.ratings[otherHost] : item.ratings.john)}
                </p>
                {!host ? <p className="text-sm">Dan: {formatRating(item.ratings.dan)}</p> : null}
                <p className="min-h-5 text-sm font-display tracking-wide" data-save-state={ratingStatus[item.id] ?? "idle"}>
                  {ratingStatus[item.id] === "saving"
                    ? "Saving…"
                    : ratingStatus[item.id] === "saved"
                      ? "Saved ✓"
                      : ratingStatus[item.id] === "error"
                        ? "Couldn't save"
                        : unsaved
                          ? "Not saved yet"
                          : ""}
                </p>
                {unsaved ? (
                  <button
                    type="button"
                    data-cancel-rating
                    className="min-h-11 w-full border-4 border-ink bg-paper px-3 text-base"
                    onClick={() => cancelRating(source)}
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  className="min-h-11 border-4 border-ink bg-paper px-3 text-sm"
                  aria-label={`Edit ${item.title}`}
                  onClick={() => edit(data.items.find((row) => row.id === item.id) ?? item)}
                >
                  Edit
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {pendingCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t-4 border-ink bg-caption p-3">
          <Button
            type="button"
            data-save-all
            className="min-h-14 flex-1 text-xl"
            onClick={() => void saveAllRatings()}
          >
            Save ({pendingCount})
          </Button>
          <Button type="button" variant="secondary" className="min-h-14" onClick={() => discardChanges()}>
            Discard changes
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={pending != null}
        description={pending ? `Delete “${pending.title}”? This removes it from Movies & TV.` : ""}
        confirmLabel="Delete"
        pending={pending != null && busy === pending.id}
        error={pending ? error : ""}
        onOpenChange={(open) => {
          if (open || busy) return;
          setPending(null);
          setError("");
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

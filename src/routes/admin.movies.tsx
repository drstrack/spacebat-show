import { upload } from "@vercel/blob/client";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import { classifyUpload } from "@/lib/chat/uploads";
import {
  episodeLines,
  MEDIA_RATING_LABEL,
  MEDIA_RATINGS,
  mediaBlobPathname,
  type MediaEntry,
  type MediaHost,
  type MediaRating,
} from "@/lib/media";
import { deleteMovie, loadMovies, rateMovie, saveMovie } from "@/lib/media.functions";

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
};

function AdminMoviesPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<MediaEntry | null>(null);

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
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          },
        },
      });
      setForm(EMPTY);
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

  async function onRate(id: string, rating: MediaRating) {
    setError("");
    setBusy(id);
    try {
      await rateMovie({ data: { id, rating } });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That rating didn’t save.");
    } finally {
      setBusy("");
    }
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
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
      </p>

      <form onSubmit={(event) => void onSave(event)} className="panel mt-8 space-y-4 bg-paper p-4 sm:p-6">
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
        <label className="block text-sm">
          Wikipedia URL
          <Input
            className="mt-1"
            value={form.wikipediaUrl}
            onChange={(event) => setForm({ ...form, wikipediaUrl: event.target.value })}
            required
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
            <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <ul className="mt-10 space-y-3">
        {data.items
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }))
          .map((item) => (
            <li key={item.id} className="border-4 border-ink bg-paper px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl leading-none tracking-wide">
                    {item.title}
                    {item.year ? ` (${item.year})` : ""}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                    {item.kind === "tv" ? "TV" : "Movie"}
                  </p>
                  <p className="mt-2 text-sm">
                    John: {MEDIA_RATING_LABEL[item.ratings.john]} · Dan: {MEDIA_RATING_LABEL[item.ratings.dan]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => edit(item)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPending(item)}>
                    Delete
                  </Button>
                </div>
              </div>
              {host ? (
                <label className="mt-3 block text-sm">
                  Your rating
                  <select
                    className="mt-1 h-11 w-full max-w-xs border-4 border-ink bg-ivory px-2"
                    value={item.ratings[host]}
                    disabled={busy === item.id}
                    aria-label={`${host === "john" ? "John" : "Dan"} rating for ${item.title}`}
                    onChange={(event) => {
                      const rating = event.target.value;
                      if (MEDIA_RATINGS.includes(rating as MediaRating)) {
                        void onRate(item.id, rating as MediaRating);
                      }
                    }}
                  >
                    {MEDIA_RATINGS.map((rating) => (
                      <option key={rating} value={rating}>
                        {MEDIA_RATING_LABEL[rating]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </li>
          ))}
      </ul>

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

import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import { stripImageFile } from "@/lib/chat/exif-strip";
import { classifyUpload } from "@/lib/chat/uploads";
import { CAPTION_MAX, type PublicFrame } from "@/lib/memorabilia/frames";
import { deleteMemorabilia, moveMemorabilia } from "@/lib/memorabilia/frames.functions";

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

export function MemorabiliaCrew({ frames }: { frames: readonly PublicFrame[] }) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<PublicFrame | null>(null);

  const uploaded = frames.filter((frame) => !frame.seed);

  async function refresh() {
    await router.invalidate();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const input = form.elements.namedItem("file");
    const picked = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!picked) {
      setError("Choose a picture.");
      return;
    }
    const heic =
      picked.type === "image/heic" ||
      picked.type === "image/heif" ||
      /\.heic$/i.test(picked.name) ||
      /\.heif$/i.test(picked.name);
    if (heic) {
      setError("Save that picture as JPEG or PNG first.");
      return;
    }
    setBusy("add");
    try {
      const prepared = await stripImageFile(picked);
      const classified = classifyUpload(prepared.name, prepared.type, prepared.size);
      if (!classified.ok || classified.kind !== "image") {
        setError(classified.ok ? "That file type isn't allowed." : classified.error);
        return;
      }
      const body = new FormData();
      body.set("file", prepared);
      body.set("caption", caption);
      const headers = new Headers();
      const token = getBearerToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch("/api/memorabilia/upload", {
        method: "POST",
        body,
        headers,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Couldn't add that frame.");
      }
      setCaption("");
      form.reset();
      await refresh();
    } catch (err) {
      setError(errorText(err, "Couldn't add that frame."));
    } finally {
      setBusy("");
    }
  }

  async function move(frame: PublicFrame, direction: "earlier" | "later") {
    setError("");
    setBusy(frame.id);
    try {
      await moveMemorabilia({ data: { id: Number(frame.id), direction } });
      await refresh();
    } catch (err) {
      setError(errorText(err, "Couldn't move that frame."));
    } finally {
      setBusy("");
    }
  }

  async function confirmDelete() {
    const frame = pending;
    if (!frame) return;
    setError("");
    setBusy(frame.id);
    try {
      await deleteMemorabilia({ data: { id: Number(frame.id) } });
      setPending(null);
      await refresh();
    } catch (err) {
      setError(errorText(err, "Couldn't delete that frame."));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel bg-paper p-5 sm:p-6" data-testid="memorabilia-crew">
      <span className="caption-box">Crew</span>
      <h2 className="mt-4 font-display text-4xl tracking-wide">Add a frame</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        JPEG, PNG, WebP, or GIF. 4 MB or smaller. The caption is optional and sits in the box under
        the panel.
      </p>
      <form className="mt-5 grid gap-4" data-testid="memorabilia-upload" onSubmit={onSubmit}>
        <label className="block text-sm" htmlFor="memorabilia-file">
          Picture
          <input
            id="memorabilia-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            className="mt-2 block w-full text-sm file:mr-3 file:border-4 file:border-ink file:bg-caption file:px-3 file:py-2 file:font-display file:text-base file:uppercase file:tracking-wide"
          />
        </label>
        <label className="block text-sm" htmlFor="memorabilia-caption">
          Caption <span className="text-muted">(optional)</span>
          <Input
            id="memorabilia-caption"
            name="caption"
            value={caption}
            maxLength={CAPTION_MAX}
            className="mt-2"
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>
        {error ? (
          <p className="text-sm text-crimson" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full sm:w-fit" disabled={busy === "add"}>
          {busy === "add" ? "Adding" : "Add frame"}
        </Button>
      </form>

      <h3 className="mt-8 font-display text-3xl tracking-wide">On the wall</h3>
      <ul className="mt-3 border-t-4 border-ink">
        {frames.map((frame, index) => {
          const uploadIndex = uploaded.findIndex((item) => item.id === frame.id);
          return (
            <li
              key={frame.id}
              className="flex flex-col gap-3 border-b-4 border-ink py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={frame.src}
                  alt=""
                  className="h-16 w-12 shrink-0 border-4 border-ink bg-ivory object-contain"
                />
                <div className="min-w-0">
                  <p className="font-display text-2xl tracking-wide">Frame {index + 1}</p>
                  <p className="truncate text-sm text-muted">
                    {frame.seed ? "Ships with the site." : frame.caption || "No caption"}
                  </p>
                </div>
              </div>
              {frame.seed ? null : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === frame.id || uploadIndex <= 0}
                    onClick={() => void move(frame, "earlier")}
                  >
                    Earlier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy === frame.id || uploadIndex === uploaded.length - 1}
                    onClick={() => void move(frame, "later")}
                  >
                    Later
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy === frame.id}
                    onClick={() => {
                      setError("");
                      setPending(frame);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={pending != null}
        description={
          pending?.caption
            ? `Delete the frame “${pending.caption}”? This removes it from the collection.`
            : "Delete this frame? This removes it from the collection."
        }
        confirmLabel="Delete"
        pendingLabel="Deleting"
        pending={pending != null && busy === pending.id}
        error={pending ? error : ""}
        onOpenChange={(open) => {
          if (open || busy) return;
          setPending(null);
          setError("");
        }}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

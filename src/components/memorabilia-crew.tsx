import { upload } from "@vercel/blob/client";
import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import { stripLocationMetadata } from "@/lib/memorabilia/gps";
import {
  CAPTION_MAX,
  MEMORABILIA_MAX_BYTES,
  MEMORABILIA_SIZE_ERROR,
  memorabiliaPathname,
  type PublicFrame,
} from "@/lib/memorabilia/frames";
import { deleteMemorabilia, moveMemorabilia, recordMemorabilia } from "@/lib/memorabilia/frames.functions";

const HEIC_JPEG_QUALITY = 0.95;

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

function contentTypeFor(file: File): string {
  if (isHeic(file)) return "image/heic";
  const type = file.type.toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type) return type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

function extensionFor(type: string, name: string): "jpg" | "png" | "gif" | "webp" | "heic" {
  if (type === "image/png" || name.toLowerCase().endsWith(".png")) return "png";
  if (type === "image/webp" || name.toLowerCase().endsWith(".webp")) return "webp";
  if (type === "image/gif" || name.toLowerCase().endsWith(".gif")) return "gif";
  if (type === "image/heic" || type === "image/heif" || /\.heic$/i.test(name) || /\.heif$/i.test(name)) {
    return "heic";
  }
  return "jpg";
}

async function prepareUpload(file: File): Promise<{ display: File; original: File | null }> {
  if (isHeic(file)) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: HEIC_JPEG_QUALITY });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error("Couldn't prepare that HEIC.");
    const stem = file.name.replace(/\.[^.]+$/, "") || "picture";
    return {
      display: new File([blob], `${stem}.jpg`, { type: "image/jpeg" }),
      original: file,
    };
  }
  const type = contentTypeFor(file);
  if (type === "image/jpeg" || type === "image/png") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stripped = stripLocationMetadata(bytes, type);
    if (stripped === bytes) return { display: file, original: null };
    const copy = new ArrayBuffer(stripped.byteLength);
    new Uint8Array(copy).set(stripped);
    return {
      display: new File([copy], file.name, { type }),
      original: null,
    };
  }
  return { display: file, original: null };
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
    if (picked.size > MEMORABILIA_MAX_BYTES) {
      setError(MEMORABILIA_SIZE_ERROR);
      return;
    }
    setBusy("add");
    try {
      const prepared = await prepareUpload(picked);
      if (prepared.display.size > MEMORABILIA_MAX_BYTES) {
        setError(MEMORABILIA_SIZE_ERROR);
        return;
      }
      if (prepared.original && prepared.original.size > MEMORABILIA_MAX_BYTES) {
        setError(MEMORABILIA_SIZE_ERROR);
        return;
      }
      try {
        await uploadToBlob(prepared, caption);
      } catch (err) {
        if (!(await blobStoreIsOff(err))) throw err;
        await uploadDirect(prepared, caption);
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
        JPEG, PNG, WebP, GIF, or iPhone HEIC. Up to 25 MB, kept at full quality. The caption is
        optional and sits in the box under the panel.
      </p>
      <form className="mt-5 grid gap-4" data-testid="memorabilia-upload" onSubmit={onSubmit}>
        <label className="block text-sm" htmlFor="memorabilia-file">
          Picture
          <input
            id="memorabilia-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
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

async function sendBlob(file: File, caption: string, commit: boolean) {
  const type = contentTypeFor(file);
  const headers: Record<string, string> = {};
  const token = getBearerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return upload(memorabiliaPathname(extensionFor(type, file.name)), file, {
    access: "public",
    handleUploadUrl: "/api/memorabilia/upload",
    contentType: type,
    multipart: file.size > 4 * 1024 * 1024,
    clientPayload: JSON.stringify({
      name: file.name,
      type,
      size: file.size,
      caption,
      commit,
    }),
    headers,
  });
}

async function uploadToBlob(prepared: { display: File; original: File | null }, caption: string) {
  const display = await sendBlob(prepared.display, caption, prepared.original == null);
  let originalPathname: string | undefined;
  if (prepared.original) {
    const original = await sendBlob(prepared.original, caption, false);
    originalPathname = original.pathname;
  }
  await recordMemorabilia({
    data: { pathname: display.pathname, originalPathname, caption },
  });
}

async function blobStoreIsOff(err: unknown): Promise<boolean> {
  if (!errorText(err, "").toLowerCase().includes("client token")) return false;
  const headers = new Headers({ "content-type": "application/json" });
  const token = getBearerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch("/api/memorabilia/upload", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname: `memorabilia/2026-10/${"a".repeat(32)}.jpg`,
        clientPayload: JSON.stringify({
          name: "a.jpg",
          type: "image/jpeg",
          size: 1,
          caption: "",
          commit: false,
        }),
        multipart: false,
      },
    }),
  });
  if (response.status !== 503) return false;
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error === "Uploads are off.";
}

async function uploadDirect(prepared: { display: File; original: File | null }, caption: string) {
  const body = new FormData();
  body.set("file", prepared.display);
  body.set("caption", caption);
  if (prepared.original) body.set("original", prepared.original);
  const headers = new Headers();
  const token = getBearerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch("/api/memorabilia/direct", {
    method: "POST",
    body,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Couldn't add that frame.");
  }
}

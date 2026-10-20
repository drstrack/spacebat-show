import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { getBearerToken } from "@/lib/auth/client";
import { stripImageFile } from "@/lib/chat/exif-strip";
import type { ChatAttachment } from "@/lib/chat/types";
import { classifyUpload, UPLOAD_ACCEPT, uploadPathname } from "@/lib/chat/uploads";
import { confirmChatUpload, discardChatUpload, prepareChatUpload } from "@/lib/chat/uploads.functions";

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

export function ComposerAttach({
  enabled,
  attachment,
  onAttachment,
  onError,
  onBusy,
  onProgress,
  removeRef,
}: {
  enabled: boolean;
  attachment: ChatAttachment | null;
  onAttachment: (next: ChatAttachment | null) => void;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
  onProgress: (value: number | null) => void;
  removeRef: MutableRefObject<(() => void) | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  function setUploadProgress(value: number | null) {
    setProgress(value);
    onProgress(value);
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    onError("");
    const heic = file.type === "image/heic" || file.type === "image/heif" || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
    if (heic) {
      onError("Save that picture as JPEG or PNG first.");
      return;
    }
    let prepared = file;
    try {
      prepared = await stripImageFile(file);
    } catch (err) {
      onError(errorText(err, "Couldn't prepare that picture."));
      return;
    }
    const classified = classifyUpload(prepared.name, prepared.type, prepared.size);
    if (!classified.ok) {
      onError(classified.error);
      return;
    }
    if (attachment) {
      const previous = attachment;
      onAttachment(null);
      void discardChatUpload({ data: { id: previous.id } }).catch(() => undefined);
    }
    const controller = new AbortController();
    abortRef.current = controller;
    onBusy(true);
    setUploadProgress(0);
    try {
      await prepareChatUpload({
        data: { name: prepared.name, type: prepared.type, size: prepared.size },
      });
      const token = getBearerToken();
      const blob = await upload(uploadPathname(prepared.name), prepared, {
        access: "public",
        handleUploadUrl: "/api/chat/upload",
        contentType: prepared.type,
        clientPayload: JSON.stringify({
          name: prepared.name,
          type: prepared.type,
          size: prepared.size,
        }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        abortSignal: controller.signal,
        onUploadProgress: (event) => setUploadProgress(event.percentage),
      });
      const saved = await confirmChatUpload({
        data: { pathname: blob.pathname, name: prepared.name },
      });
      onAttachment(saved);
      setUploadProgress(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(errorText(err, "Couldn't upload that file."));
      setUploadProgress(null);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      onBusy(false);
    }
  }

  async function onRemove() {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploadProgress(null);
    onBusy(false);
    const current = attachment;
    onAttachment(null);
    if (!current) return;
    try {
      await discardChatUpload({ data: { id: current.id } });
    } catch (err) {
      onAttachment(current);
      onError(errorText(err, "Couldn't remove that file."));
    }
  }

  removeRef.current = () => {
    void onRemove();
  };

  if (!enabled) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onPick(file);
        }}
      />
      <button
        type="button"
        aria-label="Attach a picture or file"
        disabled={progress != null}
        className="border-4 border-ink bg-paper px-2 py-1 text-base leading-none hover:bg-caption disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
      >
        📎
      </button>
    </>
  );
}

export function AttachmentDraft({
  attachment,
  progress,
  onRemove,
}: {
  attachment: ChatAttachment | null;
  progress: number | null;
  onRemove: () => void;
}) {
  if (!attachment && progress == null) return null;
  return (
    <div className="mb-2 min-w-0">
      {progress != null ? (
        <div
          className="mb-2 h-2 border-2 border-ink bg-ivory"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Upload progress"
        >
          <div
            className="h-full bg-crimson"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      {attachment ? (
        <div className="flex min-w-0 max-w-full items-center gap-3 border-2 border-ink bg-ivory px-3 py-2">
          {attachment.kind === "image" ? (
            <img src={attachment.url} alt="" className="size-14 shrink-0 border-2 border-ink object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{attachment.name}</p>
            <p className="text-xs text-muted">Ready to send</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-xs text-muted underline-offset-2 hover:text-crimson hover:underline"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

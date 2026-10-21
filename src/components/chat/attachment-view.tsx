import { FileAudio, FileText, FileVideo, File } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChatAttachment } from "@/lib/chat/types";
import { blobDownloadUrl, formatBytes, isTrustedBlobUrl, mediaPlayer } from "@/lib/chat/uploads";

export function AttachmentView({
  attachment,
  blobHost,
  showImages,
}: {
  attachment: ChatAttachment;
  blobHost: string | null;
  showImages: boolean;
}) {
  if (!isTrustedBlobUrl(attachment.url, blobHost)) return null;
  if (attachment.kind === "image") {
    if (!showImages) {
      return <p className="mt-2 text-sm text-muted">Picture hidden · {attachment.name}</p>;
    }
    return <Picture attachment={attachment} />;
  }
  return <FileCard attachment={attachment} />;
}

function Picture({ attachment }: { attachment: ChatAttachment }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (failed) {
    return <p className="mt-2 text-sm text-muted">Picture unavailable · {attachment.name}</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 block max-w-full text-left"
        aria-label={`View ${attachment.name} full size`}
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-[280px] max-w-full border-2 border-ink/30 bg-paper object-contain"
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={attachment.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-[90vh] max-w-full object-contain"
          />
        </div>
      ) : null}
    </>
  );
}

function FileCard({ attachment }: { attachment: ChatAttachment }) {
  const player = mediaPlayer(attachment.contentType);
  const Icon = player === "audio" ? FileAudio : player === "video" ? FileVideo : attachment.contentType === "application/pdf" || attachment.name.endsWith(".pdf") ? FileText : File;
  return (
    <div className="mt-2 min-w-0 max-w-full border-2 border-ink bg-ivory px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-8 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{attachment.name}</p>
          <p className="text-xs text-muted">{formatBytes(attachment.size)}</p>
        </div>
        <a
          href={blobDownloadUrl(attachment.url)}
          download={attachment.name}
          rel="noopener noreferrer"
          target="_blank"
          className="shrink-0 text-sm text-crimson underline underline-offset-2"
        >
          Download
        </a>
      </div>
      {player === "audio" ? (
        <audio controls preload="none" src={attachment.url} className="mt-2 w-full max-w-full" />
      ) : null}
      {player === "video" ? (
        <video
          controls
          preload="none"
          src={attachment.url}
          className="mt-2 max-h-64 w-full max-w-full bg-ink"
        />
      ) : null}
    </div>
  );
}

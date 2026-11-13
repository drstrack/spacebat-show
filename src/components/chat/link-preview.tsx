import { useEffect, useState } from "react";
import { previewChatLinks, type LinkPreviewResult } from "@/lib/chat/link-preview.functions";
import { firstPreviewUrl, type LinkPreview } from "@/lib/chat/link-urls";

const memory = new Map<string, LinkPreview | null>();
const waiters = new Map<string, Array<(preview: LinkPreview | null) => void>>();
const queued = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function deliver(url: string, preview: LinkPreview | null): void {
  const pending = waiters.get(url) ?? [];
  waiters.delete(url);
  for (const resolve of pending) resolve(preview);
}

async function flushQueue(): Promise<void> {
  const batch = [...queued].slice(0, 8);
  for (const url of batch) queued.delete(url);
  if (queued.size > 0 && flushTimer == null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushQueue();
    }, 0);
  }
  if (batch.length === 0) return;
  let results: LinkPreviewResult[] = [];
  try {
    results = await previewChatLinks({ data: { urls: batch } });
  } catch {
    for (const url of batch) {
      memory.set(url, null);
      deliver(url, null);
    }
    return;
  }
  const byUrl = new Map(results.map((item) => [item.url, item]));
  for (const url of batch) {
    const item = byUrl.get(url);
    if (!item || item.status === "limited") {
      deliver(url, null);
      continue;
    }
    memory.set(url, item.preview);
    deliver(url, item.preview);
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, 30);
}

function loadPreview(url: string): Promise<LinkPreview | null> {
  if (memory.has(url)) return Promise.resolve(memory.get(url) ?? null);
  return new Promise((resolve) => {
    const list = waiters.get(url) ?? [];
    list.push(resolve);
    waiters.set(url, list);
    queued.add(url);
    scheduleFlush();
  });
}

function useMessageLinkPreview(url: string | null): LinkPreview | null {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  useEffect(() => {
    if (!url) {
      setPreview(null);
      return;
    }
    if (memory.has(url)) {
      setPreview(memory.get(url) ?? null);
      return;
    }
    let cancel = false;
    setPreview(null);
    void loadPreview(url).then((value) => {
      if (!cancel) setPreview(value);
    });
    return () => {
      cancel = true;
    };
  }, [url]);
  return preview;
}

function previewImageSrc(image: string | null): string | null {
  if (!image) return null;
  try {
    const url = new URL(image);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function PreviewCard({ url, preview }: { url: string; preview: LinkPreview }) {
  const src = previewImageSrc(preview.image);
  const [imageOk, setImageOk] = useState(true);
  useEffect(() => {
    setImageOk(true);
  }, [src]);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      data-chat-link-preview=""
      className="mt-2 flex w-full max-w-full overflow-hidden border-2 border-ink/30 bg-paper no-underline hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson sm:max-w-md"
    >
      {src && imageOk ? (
        <span className="h-20 w-28 shrink-0 border-r-2 border-ink/20 bg-ivory sm:h-24 sm:w-36">
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageOk(false)}
            className="h-full w-full object-cover"
          />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 px-3 py-2">
        <span className="block truncate text-xs text-muted">{preview.siteName}</span>
        {preview.title ? (
          <span className="mt-0.5 line-clamp-2 break-words text-sm font-semibold leading-snug text-ink">
            {preview.title}
          </span>
        ) : null}
        {preview.description ? (
          <span className="mt-1 line-clamp-2 break-words text-xs leading-snug text-muted">
            {preview.description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

/** Preview card for the first http(s) URL in a message. A miss stays a plain link. */
export function MessageLinkPreview({ body }: { body: string }) {
  const url = firstPreviewUrl(body);
  const preview = useMessageLinkPreview(url);
  if (!url || !preview) return null;
  if (!preview.title && !preview.description && !preview.image) return null;
  return <PreviewCard url={url} preview={preview} />;
}

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { searchGifs, type GifHit } from "@/lib/chat/gifs.functions";

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "GIF search is unavailable.";
}

export function GifPicker({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GifHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      setHits(await searchGifs({ data: { q } }));
    } catch (err) {
      setHits([]);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    void runSearch();
  }

  function onSearchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    void runSearch();
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Search GIFs"
        className="border-4 border-ink bg-paper px-2 py-1 font-display text-sm tracking-wide hover:bg-caption"
        onClick={() => setOpen((value) => !value)}
      >
        GIF
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="GIF search"
          className="absolute bottom-full left-0 z-30 mb-2 w-[min(22rem,calc(100vw-2rem))] border-4 border-ink bg-paper p-2 shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search GIFs</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
                maxLength={50}
                placeholder="Search GIFs"
                className="w-full border-4 border-ink bg-ivory px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="border-4 border-ink bg-caption px-2 py-1 text-sm"
            >
              {busy ? "…" : "Search"}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-crimson">{error}</p> : null}
          {hits.length === 0 && !error && !busy ? (
            <p className="mt-2 text-sm text-muted">Search, then pick a GIF.</p>
          ) : null}
          <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            {hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                className="border-2 border-ink/30 bg-ivory"
                onClick={() => {
                  onInsert(`https://i.giphy.com/${hit.id}.gif `);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <img
                  src={hit.preview}
                  alt={hit.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full object-cover"
                />
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span>Powered by</span>
            <img src="/brand/powered-by-giphy.png" alt="GIPHY" className="h-4 w-auto" />
          </p>
        </div>
      ) : null}
    </div>
  );
}

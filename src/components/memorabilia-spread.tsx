import { useEffect, useState } from "react";
import { renderComicSpread, type PublicFrame } from "@/lib/memorabilia/frames";

export function MemorabiliaSpread({ frames }: { frames: readonly PublicFrame[] }) {
  const [open, setOpen] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        className="comic-page"
        data-testid="comic-spread"
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }
          const link = (event.target as Element).closest?.("a.comic-frame-link");
          if (!(link instanceof HTMLAnchorElement)) return;
          event.preventDefault();
          const image = link.querySelector("img");
          setOpen({ src: link.href, alt: image?.getAttribute("alt") ?? "" });
        }}
        dangerouslySetInnerHTML={{ __html: renderComicSpread(frames) }}
      />
      {open ? (
        <div
          className="comic-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Full size frame"
          data-testid="comic-lightbox"
          onClick={() => setOpen(null)}
        >
          <img src={open.src} alt={open.alt} />
        </div>
      ) : null}
    </>
  );
}

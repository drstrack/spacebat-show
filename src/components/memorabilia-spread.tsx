import { renderComicSpread, type PublicFrame } from "@/lib/memorabilia/frames";

export function MemorabiliaSpread({ frames }: { frames: readonly PublicFrame[] }) {
  return (
    <div
      className="comic-page"
      data-testid="comic-spread"
      dangerouslySetInnerHTML={{ __html: renderComicSpread(frames) }}
    />
  );
}

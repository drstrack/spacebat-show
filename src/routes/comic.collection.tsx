import { createFileRoute } from "@tanstack/react-router";
import { MemorabiliaCrew } from "@/components/memorabilia-crew";
import { MemorabiliaSpread } from "@/components/memorabilia-spread";
import { collectionHeadMeta, COLLECTION_INTRO } from "@/lib/memorabilia/frames";
import { loadMemorabilia } from "@/lib/memorabilia/frames.functions";

export const Route = createFileRoute("/comic/collection")({
  loader: () => loadMemorabilia(),
  staleTime: 0,
  head: () => collectionHeadMeta(),
  component: CollectionPage,
});

function CollectionPage() {
  const { frames, canManage } = Route.useLoaderData();

  return (
    <article>
      <header className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div className="panel bg-paper p-6 sm:p-10">
          <span className="caption-box w-fit">John Mulligan</span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-none tracking-wide sm:text-6xl">
            Comic and movie collectibles.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{COLLECTION_INTRO}</p>
        </div>
      </header>

      {canManage ? (
        <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
          <MemorabiliaCrew frames={frames} />
        </div>
      ) : null}

      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-5 sm:py-8">
        <MemorabiliaSpread frames={frames} />
      </section>
    </article>
  );
}

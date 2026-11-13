import { createFileRoute } from "@tanstack/react-router";
import { TechDesk, TechEmpty, TechGrid } from "@/components/tech-desk";
import { TECH_DESCRIPTION, TECH_OG_IMAGE, TECH_PAGE_HEAD, TECH_URL } from "@/lib/tech/products";
import { loadTech } from "@/lib/tech/products.functions";

export const Route = createFileRoute("/tech")({
  loader: () => loadTech(),
  staleTime: 0,
  head: () => ({
    meta: [
      { title: TECH_PAGE_HEAD },
      { name: "description", content: TECH_DESCRIPTION },
      { name: "spacebat:og-title", content: TECH_PAGE_HEAD },
      { name: "spacebat:og-description", content: TECH_DESCRIPTION },
      { name: "spacebat:og-image", content: TECH_OG_IMAGE },
      { name: "spacebat:og-image:width", content: "1200" },
      { name: "spacebat:og-image:height", content: "630" },
      { name: "spacebat:og-url", content: TECH_URL },
    ],
  }),
  component: TechPage,
});

function TechPage() {
  const { products, canManage, viewerHost } = Route.useLoaderData();

  return (
    <article>
      <header className="mx-auto max-w-6xl px-3 pt-6 sm:px-5">
        <div className="panel bg-paper p-6 sm:p-10">
          <span className="caption-box w-fit">The booth</span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-none tracking-wide sm:text-6xl">Tech</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{TECH_DESCRIPTION}</p>
        </div>
      </header>

      {canManage ? (
        <div className="pt-6">
          <TechDesk products={products} viewerHost={viewerHost} />
        </div>
      ) : (
        <section className="mx-auto max-w-6xl px-3 py-6 sm:px-5">
          {products.length === 0 ? <TechEmpty canManage={false} /> : <TechGrid products={products} />}
        </section>
      )}
    </article>
  );
}

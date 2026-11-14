import { createFileRoute, Link } from "@tanstack/react-router";
import { TechDesk } from "@/components/tech-desk";
import { loadTech } from "@/lib/tech/products.functions";

export const Route = createFileRoute("/admin/tech")({
  loader: () => loadTech(),
  staleTime: 0,
  component: AdminTechPage,
});

function AdminTechPage() {
  const data = Route.useLoaderData();

  if (!data.canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-wide">Crew only</h1>
        <p className="mt-3 text-sm text-muted">Sign in as an admin to edit tech products.</p>
        <Link to="/login" className="mt-6 inline-block font-display text-xl text-crimson hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="caption-box">Back end</p>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-wide">Tech</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Add a product, fix the name or picture, or take one down. Visitors only see the list.
        Lower sort numbers show first.
      </p>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/admin" className="font-display text-2xl tracking-wide text-crimson hover:underline">
          Analytics
        </Link>
        <Link to="/tech" className="font-display text-2xl tracking-wide text-crimson hover:underline">
          The public page
        </Link>
      </p>
      <div className="mt-8">
        <TechDesk products={data.products} viewerHost={data.viewerHost} />
      </div>
    </div>
  );
}

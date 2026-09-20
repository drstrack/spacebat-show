import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/episodes/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/podcast/$slug", params: { slug: params.slug } });
  },
});

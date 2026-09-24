import { createFileRoute, redirect } from "@tanstack/react-router";
import { loadListenTarget } from "@/lib/podcast-feed.functions";

export const Route = createFileRoute("/listen")({
  beforeLoad: async () => {
    const target = await loadListenTarget();
    if (target.live || !target.slug) {
      throw redirect({ to: "/podcast", hash: "live" });
    }
    throw redirect({ to: "/podcast/$slug", params: { slug: target.slug } });
  },
});

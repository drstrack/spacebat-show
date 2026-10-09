import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return new Response("No.", { status: 401 });
  }
  const { runPodcastAlerts } = await import("@/lib/podcast-alerts.server");
  try {
    const result = await runPodcastAlerts();
    return Response.json(result);
  } catch (error) {
    console.error("podcast alerts", error instanceof Error ? error.message : "failed");
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/alerts/run")({
  server: {
    handlers: {
      GET: handle,
    },
  },
});

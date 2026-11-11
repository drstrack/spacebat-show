import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  return Boolean(secret) && header === `Bearer ${secret}`;
}

async function handle({ request }: { request: Request }) {
  if (!authorized(request)) return new Response("No.", { status: 401 });
  const { runPodcastAlerts, logAlertFailure } = await import("@/lib/podcast-alerts.server");
  const { classifyAlertError } = await import("@/lib/podcast-alert-delivery");
  try {
    const result = await runPodcastAlerts();
    return Response.json(result);
  } catch (error) {
    logAlertFailure(new Date(), error);
    return Response.json({ ok: false, error: classifyAlertError(error) }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/alerts/run")({
  server: {
    handlers: {
      GET: handle,
    },
  },
});

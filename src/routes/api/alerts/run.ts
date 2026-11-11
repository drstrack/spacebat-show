import { createFileRoute } from "@tanstack/react-router";
import { alertAuthResponse } from "@/lib/alert-auth";

async function handle({ request }: { request: Request }) {
  const denied = alertAuthResponse("run", request);
  if (denied) return denied;
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

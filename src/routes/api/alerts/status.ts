import { createFileRoute } from "@tanstack/react-router";
import { nyDateKey } from "@/lib/schedule-exceptions";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  return Boolean(secret) && header === `Bearer ${secret}`;
}

/**
 * Monitor poll. After 12:15 PM America/New_York, HTTP 503 means the expected
 * morning alert is not logged for every opted-in recipient. The body has
 * counts and an error class. It has no addresses and no secrets.
 */
async function handle({ request }: { request: Request }) {
  if (!authorized(request)) return new Response("No.", { status: 401 });
  const { readAlertHealth, logAlertFailure } = await import("@/lib/podcast-alerts.server");
  const { classifyAlertError } = await import("@/lib/podcast-alert-delivery");
  try {
    const health = await readAlertHealth();
    return Response.json(
      {
        ok: health.ok,
        date: health.date,
        zone: "America/New_York",
        expectedKind: health.expectedKind,
        expectedRef: health.expectedRef,
        sent: health.sent,
        expected: health.expected,
        error: health.error,
        pastCutoff: health.pastCutoff,
        delivery: health.delivery,
        window: "07:00-11:59",
        cutoff: "12:00",
      },
      { status: health.httpStatus },
    );
  } catch (error) {
    logAlertFailure(new Date(), error);
    return Response.json(
      {
        ok: false,
        date: nyDateKey(new Date()),
        zone: "America/New_York",
        error: classifyAlertError(error),
        delivery: "error",
      },
      { status: 503 },
    );
  }
}

export const Route = createFileRoute("/api/alerts/status")({
  server: {
    handlers: {
      GET: handle,
    },
  },
});

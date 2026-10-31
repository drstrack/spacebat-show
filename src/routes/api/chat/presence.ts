import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";

/**
 * Last heartbeat when a tab closes. `sendBeacon` cannot set the preview bearer
 * header, so a cookie session is what authorizes this route. The interval
 * heartbeat uses the server function, which does forward that bearer. Either
 * way, closing the tab stops the heartbeats and Online drops them after the timeout.
 */
async function handle() {
  try {
    assertSameSiteRequest();
    const userId = await requireUserId();
    const { pulsePresenceFor } = await import("@/lib/chat/presence.server");
    await pulsePresenceFor(userId);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
    if (err instanceof CrossSiteRequestError) return new Response(null, { status: 403 });
    const message = err instanceof Error ? err.message : "";
    const status = message === "Unauthorized" ? 401 : 400;
    return new Response(null, { status });
  }
}

export const Route = createFileRoute("/api/chat/presence")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});

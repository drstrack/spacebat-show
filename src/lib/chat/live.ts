export type LiveProbe = "on" | "off" | "unknown";

export type LiveState = {
  isLive: boolean;
  sinceMs: number | null;
  source: string | null;
  manual: string | null;
  manualUntilMs: number | null;
  offChecks: number;
  lastAlertMs: number | null;
};

export type LiveTransition = "went-live" | "went-off" | null;

export const LIVE_ALERT_GAP_MS = 3 * 60 * 60 * 1000;
export const MIN_LIVE_MS = 10 * 60 * 1000;
export const CHECK_GAP_MS = 30_000;

const LIVE_BODY = "🔴 The SpaceBat Show is LIVE. Hit Play live to listen in.";
const ENDED_BODY = "📴 That's the show. Thanks for hanging out!";

export { LIVE_BODY, ENDED_BODY };

export function shouldPostLiveAlert(lastAlertMs: number | null, now: number): boolean {
  if (lastAlertMs == null) return true;
  return now - lastAlertMs > LIVE_ALERT_GAP_MS;
}

/**
 * One "on" goes live. Two consecutive checks with no "on" and at least one
 * "off" go off. Unknown on both sides keeps the current state. A manual
 * override wins until it expires.
 */
export function decideLive(
  state: LiveState,
  icecast: LiveProbe,
  feed: LiveProbe,
  now: number,
): { state: LiveState; transition: LiveTransition } {
  const manualActive =
    (state.manual === "live" || state.manual === "off") &&
    state.manualUntilMs != null &&
    now < state.manualUntilMs;

  let isLive = state.isLive;
  let source = state.source;
  let offChecks = state.offChecks;

  if (manualActive && state.manual === "live") {
    isLive = true;
    source = "manual";
    offChecks = 0;
  } else if (manualActive && state.manual === "off") {
    isLive = false;
    source = "manual";
    offChecks = 0;
  } else if (icecast === "on" || feed === "on") {
    isLive = true;
    source = icecast === "on" ? "stream" : "feed";
    offChecks = 0;
  } else if (icecast === "unknown" && feed === "unknown") {
    source = state.source;
  } else {
    offChecks = state.offChecks + 1;
    if (state.isLive && offChecks >= 2) {
      isLive = false;
      source = icecast === "off" ? "stream" : "feed";
    }
  }

  let transition: LiveTransition = null;
  let sinceMs = state.sinceMs;
  if (!state.isLive && isLive) {
    transition = "went-live";
    sinceMs = now;
    offChecks = 0;
  } else if (state.isLive && !isLive) {
    transition = "went-off";
  }

  return {
    transition,
    state: {
      ...state,
      isLive,
      sinceMs,
      source,
      offChecks,
    },
  };
}

export function iceStatus(status: number): LiveProbe {
  if (status >= 200 && status <= 299) return "on";
  if (status === 404) return "off";
  return "unknown";
}

/** Headers only. The body is aborted so the stream audio is never downloaded. */
export async function probeIcecast(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4_000,
): Promise<LiveProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { "Icy-MetaData": "0" },
      signal: controller.signal,
    });
    const status = response.status;
    void response.body?.cancel().catch(() => undefined);
    controller.abort();
    return iceStatus(status);
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

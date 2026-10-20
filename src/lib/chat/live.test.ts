import assert from "node:assert/strict";
import test from "node:test";
import {
  decideLive,
  LIVE_ALERT_GAP_MS,
  probeIcecast,
  shouldPostLiveAlert,
  type LiveState,
} from "./live.ts";

const now = 1_700_000_000_000;

function state(patch: Partial<LiveState> = {}): LiveState {
  return {
    isLive: false,
    sinceMs: null,
    source: null,
    manual: null,
    manualUntilMs: null,
    offChecks: 0,
    lastAlertMs: null,
    ...patch,
  };
}

test("one on probe goes live", () => {
  const decision = decideLive(state(), "on", "off", now);
  assert.equal(decision.transition, "went-live");
  assert.equal(decision.state.isLive, true);
  assert.equal(decision.state.source, "stream");
  assert.equal(decision.state.sinceMs, now);
});

test("one off probe leaves a live show up", () => {
  const decision = decideLive(
    state({ isLive: true, sinceMs: now - 60_000, source: "stream" }),
    "off",
    "off",
    now,
  );
  assert.equal(decision.transition, null);
  assert.equal(decision.state.isLive, true);
  assert.equal(decision.state.offChecks, 1);
});

test("two off probes end the show", () => {
  const decision = decideLive(
    state({ isLive: true, sinceMs: now - 60_000, source: "stream", offChecks: 1 }),
    "off",
    "unknown",
    now,
  );
  assert.equal(decision.transition, "went-off");
  assert.equal(decision.state.isLive, false);
});

test("unknown probes keep the current state", () => {
  const live = decideLive(
    state({ isLive: true, sinceMs: now - 1000, source: "feed" }),
    "unknown",
    "unknown",
    now,
  );
  assert.equal(live.transition, null);
  assert.equal(live.state.isLive, true);
  assert.equal(live.state.source, "feed");
  const dark = decideLive(state(), "unknown", "unknown", now);
  assert.equal(dark.state.isLive, false);
  assert.equal(dark.transition, null);
});

test("manual live overrides off probes until it expires", () => {
  const held = decideLive(
    state({ manual: "live", manualUntilMs: now + 60_000 }),
    "off",
    "off",
    now,
  );
  assert.equal(held.state.isLive, true);
  assert.equal(held.state.source, "manual");
  assert.equal(held.transition, "went-live");

  const expired = decideLive(
    state({
      isLive: true,
      sinceMs: now - 1000,
      manual: "live",
      manualUntilMs: now - 1,
      offChecks: 1,
    }),
    "off",
    "off",
    now,
  );
  assert.equal(expired.state.isLive, false);
  assert.equal(expired.transition, "went-off");
});

test("manual off suppresses on probes for 15 minutes", () => {
  const held = decideLive(
    state({
      isLive: true,
      sinceMs: now - 1000,
      manual: "off",
      manualUntilMs: now + 15 * 60 * 1000,
    }),
    "on",
    "on",
    now,
  );
  assert.equal(held.state.isLive, false);
  assert.equal(held.state.source, "manual");
  assert.equal(held.transition, "went-off");
});

test("a live alert posts once per three hours", () => {
  assert.equal(shouldPostLiveAlert(null, now), true);
  assert.equal(shouldPostLiveAlert(now - LIVE_ALERT_GAP_MS, now), false);
  assert.equal(shouldPostLiveAlert(now - LIVE_ALERT_GAP_MS - 1, now), true);
});

test("probeIcecast maps status and a timeout", async () => {
  const asFetch =
    (status: number): typeof fetch =>
    async () =>
      new Response(null, { status });
  assert.equal(await probeIcecast("https://stream.example/live", asFetch(200), 1000), "on");
  assert.equal(await probeIcecast("https://stream.example/live", asFetch(404), 1000), "off");
  assert.equal(await probeIcecast("https://stream.example/live", asFetch(500), 1000), "unknown");

  const timeoutFetch: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  assert.equal(await probeIcecast("https://stream.example/live", timeoutFetch, 20), "unknown");
});

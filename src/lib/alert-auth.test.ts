import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alertAuthResponse, authorizeAlertRoute, bearerMatches } from "./alert-auth.ts";

const ENV = {
  CRON_SECRET: "cron-secret-value",
  ALERTS_STATUS_TOKEN: "status-token-value",
};

function request(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return new Request("https://www.spacebatshow.net/api/alerts/status", { headers });
}

describe("alert route auth", () => {
  it("lets the status token read status and rejects it on run", () => {
    const status = alertAuthResponse("status", request("Bearer status-token-value"), ENV);
    const run = alertAuthResponse("run", request("Bearer status-token-value"), ENV);
    assert.equal(status, null);
    assert.ok(run);
    assert.equal(run.status, 401);
    assert.equal(authorizeAlertRoute("run", "Bearer status-token-value", ENV), false);
    assert.equal(authorizeAlertRoute("status", "Bearer status-token-value", ENV), true);

    const root = dirname(fileURLToPath(import.meta.url));
    const runSource = readFileSync(join(root, "../routes/api/alerts/run.ts"), "utf8");
    const statusSource = readFileSync(join(root, "../routes/api/alerts/status.ts"), "utf8");
    assert.match(runSource, /alertAuthResponse\("run", request\)/);
    assert.equal(runSource.includes("ALERTS_STATUS_TOKEN"), false);
    assert.match(statusSource, /alertAuthResponse\("status", request\)/);
  });

  it("still accepts CRON_SECRET on both routes", () => {
    assert.equal(alertAuthResponse("run", request("Bearer cron-secret-value"), ENV), null);
    assert.equal(alertAuthResponse("status", request("Bearer cron-secret-value"), ENV), null);
  });

  it("leaves status unchanged when ALERTS_STATUS_TOKEN is unset", () => {
    const env = { CRON_SECRET: "cron-secret-value" };
    assert.equal(authorizeAlertRoute("status", "Bearer status-token-value", env), false);
    assert.equal(authorizeAlertRoute("status", "Bearer cron-secret-value", env), true);
    assert.equal(authorizeAlertRoute("run", "Bearer cron-secret-value", env), true);
    const denied = alertAuthResponse("status", request("Bearer status-token-value"), env);
    assert.equal(denied?.status, 401);
  });

  it("rejects a missing, empty, or wrong bearer", () => {
    assert.equal(alertAuthResponse("status", request(), ENV)?.status, 401);
    assert.equal(alertAuthResponse("run", request("Bearer "), ENV)?.status, 401);
    assert.equal(alertAuthResponse("status", request("Bearer nope"), ENV)?.status, 401);
    assert.equal(authorizeAlertRoute("status", "Bearer status-token-value", {}), false);
    assert.equal(authorizeAlertRoute("run", "Bearer cron-secret-value", {}), false);
  });

  it("compares without throwing when the lengths differ and does not log the token", () => {
    const lines: string[] = [];
    const original = console.log;
    const originalError = console.error;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      assert.equal(bearerMatches("Bearer short", ENV.ALERTS_STATUS_TOKEN), false);
      assert.equal(bearerMatches("Bearer status-token-value-extra", ENV.ALERTS_STATUS_TOKEN), false);
      assert.equal(bearerMatches("Bearer status-token-value", ENV.ALERTS_STATUS_TOKEN), true);
      assert.equal(bearerMatches("bearer status-token-value", ENV.ALERTS_STATUS_TOKEN), false);
      alertAuthResponse("run", request("Bearer status-token-value"), ENV);
      alertAuthResponse("status", request("Bearer status-token-value"), ENV);
    } finally {
      console.log = original;
      console.error = originalError;
    }
    const dumped = lines.join("\n");
    assert.equal(dumped.includes("status-token-value"), false);
    assert.equal(dumped.includes("cron-secret-value"), false);
  });
});

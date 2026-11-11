import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alertFailureSummary,
  alertRunSummary,
  assessAlertHealth,
  classifyAlertError,
  deliverAlert,
  resendAlreadyAccepted,
} from "./podcast-alert-delivery.ts";
import { americaNewYorkToUtc, type ScheduleException } from "./schedule-exceptions.ts";

const PEOPLE = [{ email: "ada@example.com" }, { email: "bea@example.com" }];

function memoryLog() {
  const rows = new Set<string>();
  const sent: string[] = [];
  return {
    rows,
    sent,
    async claim(email: string) {
      if (rows.has(email)) return false;
      rows.add(email);
      return true;
    },
    async release(email: string) {
      rows.delete(email);
    },
    async send(email: string) {
      sent.push(email);
    },
  };
}

describe("deliverAlert", () => {
  it("sends once per recipient and skips them on a later run", async () => {
    const log = memoryLog();
    const first = await deliverAlert({
      people: PEOPLE,
      alreadyLogged: [],
      claim: log.claim,
      send: log.send,
      release: log.release,
    });
    const second = await deliverAlert({
      people: PEOPLE,
      alreadyLogged: [...log.rows],
      claim: log.claim,
      send: log.send,
      release: log.release,
    });
    assert.equal(first.sent, 2);
    assert.equal(first.skipped, 0);
    assert.equal(second.sent, 0);
    assert.equal(second.skipped, 2);
    assert.deepEqual(log.sent, ["ada@example.com", "bea@example.com"]);
  });

  it("retries only the recipient whose provider send failed", async () => {
    const log = memoryLog();
    let failBea = true;
    const send = async (email: string) => {
      if (email === "bea@example.com" && failBea) {
        const error = new Error("Could not send the podcast alert") as Error & { status?: number };
        error.status = 500;
        throw error;
      }
      log.sent.push(email);
    };
    const first = await deliverAlert({
      people: PEOPLE,
      alreadyLogged: [],
      claim: log.claim,
      send,
      release: log.release,
    });
    assert.equal(first.sent, 1);
    assert.equal(first.errors, 1);
    assert.equal(first.error, "provider");
    assert.equal(log.rows.has("bea@example.com"), false);
    assert.equal(log.rows.has("ada@example.com"), true);

    failBea = false;
    const second = await deliverAlert({
      people: PEOPLE,
      alreadyLogged: [...log.rows],
      claim: log.claim,
      send,
      release: log.release,
    });
    assert.equal(second.sent, 1);
    assert.equal(second.errors, 0);
    assert.deepEqual(log.sent, ["ada@example.com", "bea@example.com"]);
  });

  it("does not send over a seeded star row", async () => {
    const log = memoryLog();
    const result = await deliverAlert({
      people: PEOPLE,
      alreadyLogged: ["*"],
      claim: log.claim,
      send: log.send,
      release: log.release,
    });
    assert.deepEqual(result, { sent: 0, skipped: 2, errors: 0, error: null });
    assert.deepEqual(log.sent, []);
  });

  it("treats a Resend idempotency conflict as already sent", () => {
    assert.equal(resendAlreadyAccepted(409, '{"name":"invalid_idempotent_request"}'), true);
    assert.equal(resendAlreadyAccepted(409, '{"name":"concurrent_idempotent_requests"}'), false);
    assert.equal(resendAlreadyAccepted(500, "invalid_idempotent_request"), false);
  });

  it("classifies a Turso connect timeout", () => {
    const cause = new Error("connect ETIMEDOUT 54.144.175.141:443") as Error & { code?: string };
    cause.code = "ETIMEDOUT";
    const error = new TypeError("fetch failed");
    error.cause = cause;
    assert.equal(classifyAlertError(error), "timeout");
    assert.equal(classifyAlertError(new Error("Podcast alert email is not configured")), "config");
  });
});

function at(dateKey: string, hour: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(americaNewYorkToUtc(year!, month!, day!, hour, 15));
}

describe("alert health", () => {
  const cancel: ScheduleException = {
    skipDate: "2026-11-11",
    showStart: null,
    note: "This week only: no live SpaceBat show on November 11.",
  };

  it("stays healthy during the morning and fails after noon when someone was missed", () => {
    const pending = assessAlertHealth({
      now: at("2026-11-11", 9),
      sent: 1,
      recipients: 2,
      runError: "timeout",
    });
    assert.equal(pending.ok, true);
    assert.equal(pending.httpStatus, 200);
    assert.equal(pending.delivery, "pending");
    assert.equal(pending.expectedKind, "show-day");
    assert.equal(pending.expectedRef, "2026-11-11");
    assert.equal(pending.error, "timeout");

    const short = assessAlertHealth({
      now: at("2026-11-11", 12),
      sent: 1,
      recipients: 2,
    });
    assert.equal(short.ok, false);
    assert.equal(short.httpStatus, 503);
    assert.equal(short.delivery, "short");
    assert.equal(short.error, "short");
    assert.equal(short.sent, 1);
    assert.equal(short.expected, 2);
  });

  it("is healthy once every recipient is logged, including before noon", () => {
    const health = assessAlertHealth({
      now: at("2026-11-11", 8),
      sent: 2,
      recipients: 2,
      runError: "provider",
    });
    assert.equal(health.ok, true);
    assert.equal(health.delivery, "ok");
    assert.equal(health.error, null);
  });

  it("expects the skip note on a cancelled Wednesday and nothing the next day", () => {
    const skipped = assessAlertHealth({
      now: at("2026-11-11", 13),
      exceptions: [cancel],
      sent: 0,
      recipients: 2,
    });
    assert.equal(skipped.expectedKind, "schedule-change");
    assert.equal(skipped.expectedRef, "2026-11-11");
    assert.equal(skipped.ok, false);
    const thursday = assessAlertHealth({
      now: at("2026-11-12", 13),
      exceptions: [cancel],
      sent: 0,
      recipients: 2,
    });
    assert.equal(thursday.ok, true);
    assert.equal(thursday.expectedKind, null);
    assert.equal(thursday.httpStatus, 200);
  });

  it("reports zero recipients after the cutoff", () => {
    const health = assessAlertHealth({
      now: at("2026-11-11", 12),
      sent: 0,
      recipients: 0,
    });
    assert.equal(health.ok, false);
    assert.equal(health.error, "recipients");
    assert.equal(health.httpStatus, 503);
  });

  it("logs one line with counts and no addresses", () => {
    const health = assessAlertHealth({
      now: at("2026-11-11", 8),
      sent: 2,
      recipients: 2,
    });
    const line = alertRunSummary({
      planned: 1,
      showDay: 2,
      scheduleChange: 0,
      posted: 0,
      skipped: 0,
      errors: 0,
      error: null,
      feed: "down",
      health,
    });
    assert.match(line, /^podcast alerts date=2026-11-11 /);
    assert.match(line, /planned=1/);
    assert.match(line, /showDay=2/);
    assert.match(line, /feed=down/);
    assert.match(line, /delivery=ok/);
    assert.match(line, /sent=2/);
    assert.match(line, /expected=2/);
    assert.equal(line.includes("@"), false);
    const failed = alertFailureSummary(at("2026-11-11", 8), "timeout");
    assert.match(failed, /error=timeout/);
    assert.match(failed, /delivery=error/);
    assert.equal(failed.includes("@"), false);
  });
});

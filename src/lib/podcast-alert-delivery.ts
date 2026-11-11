/** Who still needs a podcast alert, and whether the morning is healthy. No I/O. */

import { alertDayPlan } from "./schedule-change.ts";
import {
  nyDateKey,
  pastAlertCutoff,
  type ScheduleException,
  scheduleExceptions,
} from "./schedule-exceptions.ts";

export type AlertErrorClass =
  | "timeout"
  | "database"
  | "provider"
  | "feed"
  | "config"
  | "recipients"
  | "short"
  | "unknown";

export type DeliveryState = "ok" | "pending" | "short" | "error";

export type DeliveryTally = {
  sent: number;
  skipped: number;
  errors: number;
  error: AlertErrorClass | null;
};

export type AlertHealth = {
  ok: boolean;
  httpStatus: 200 | 503;
  date: string;
  expectedKind: "show-day" | "schedule-change" | null;
  expectedRef: string | null;
  sent: number;
  expected: number;
  error: AlertErrorClass | null;
  pastCutoff: boolean;
  delivery: DeliveryState;
};

/**
 * Send to people who are not already logged. `claim` inserts the send-log
 * row and returns false when another run already owns it. A failed send
 * releases the claim so a later run the same morning can retry that person.
 * A "*" log row is the posted-episode seed and sends nothing.
 */
export async function deliverAlert(input: {
  people: readonly { email: string }[];
  alreadyLogged: readonly string[];
  claim: (email: string) => Promise<boolean>;
  send: (email: string) => Promise<void>;
  release: (email: string) => Promise<void>;
}): Promise<DeliveryTally> {
  const logged = input.alreadyLogged.map((email) => email.toLowerCase());
  if (logged.includes("*")) {
    return { sent: 0, skipped: input.people.length, errors: 0, error: null };
  }
  const already = new Set(logged);
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let error: AlertErrorClass | null = null;
  const note = (err: unknown) => {
    errors += 1;
    error ??= classifyAlertError(err);
  };
  for (const person of input.people) {
    const email = person.email.toLowerCase();
    if (already.has(email)) {
      skipped += 1;
      continue;
    }
    let claimed = false;
    try {
      claimed = await input.claim(email);
    } catch (err) {
      note(err);
      continue;
    }
    if (!claimed) {
      skipped += 1;
      continue;
    }
    try {
      await input.send(email);
      sent += 1;
      already.add(email);
    } catch (err) {
      note(err);
      try {
        await input.release(email);
      } catch (releaseErr) {
        note(releaseErr);
      }
    }
  }
  return { sent, skipped, errors, error };
}

/**
 * Healthy before noon while retries remain. After noon, healthy only when
 * every opted-in recipient has a log row, or when today expects no mail.
 */
export function assessAlertHealth(input: {
  now: Date;
  exceptions?: readonly ScheduleException[];
  sent: number;
  recipients: number;
  runError?: AlertErrorClass | null;
}): AlertHealth {
  const exceptions = input.exceptions ?? scheduleExceptions;
  const plan = alertDayPlan(input.now, exceptions);
  const pastCutoff = pastAlertCutoff(input.now);
  const date = nyDateKey(input.now);
  const expectedKind = plan?.kind ?? null;
  const expectedRef =
    plan?.kind === "schedule-change" ? plan.exception.skipDate : plan?.kind === "show-day" ? plan.date : null;
  const base = {
    date,
    expectedKind,
    expectedRef,
    sent: plan ? input.sent : 0,
    expected: plan ? input.recipients : 0,
    pastCutoff,
  };
  if (!plan) {
    return { ...base, ok: true, httpStatus: 200, error: null, delivery: "ok" };
  }
  const runError = input.runError && input.runError !== "feed" ? input.runError : null;
  if (input.recipients <= 0) {
    if (!pastCutoff) {
      return { ...base, ok: true, httpStatus: 200, error: null, delivery: "pending" };
    }
    return { ...base, ok: false, httpStatus: 503, error: "recipients", delivery: "short" };
  }
  if (input.sent >= input.recipients) {
    return { ...base, ok: true, httpStatus: 200, error: null, delivery: "ok" };
  }
  if (!pastCutoff) {
    return { ...base, ok: true, httpStatus: 200, error: runError, delivery: "pending" };
  }
  return {
    ...base,
    ok: false,
    httpStatus: 503,
    error: runError ?? "short",
    delivery: "short",
  };
}

export function alertRunSummary(input: {
  planned: number;
  showDay: number;
  scheduleChange: number;
  posted: number;
  skipped: number;
  errors: number;
  error: AlertErrorClass | null;
  feed: "ok" | "down" | "unknown";
  health: AlertHealth;
}): string {
  return [
    "podcast alerts",
    `date=${input.health.date}`,
    `planned=${input.planned}`,
    `showDay=${input.showDay}`,
    `scheduleChange=${input.scheduleChange}`,
    `posted=${input.posted}`,
    `skipped=${input.skipped}`,
    `errors=${input.errors}`,
    `error=${input.error ?? "none"}`,
    `feed=${input.feed}`,
    `delivery=${input.health.delivery}`,
    `sent=${input.health.sent}`,
    `expected=${input.health.expected}`,
  ].join(" ");
}

export function alertFailureSummary(now: Date, error: AlertErrorClass): string {
  const date = nyDateKey(now);
  return [
    "podcast alerts",
    `date=${date}`,
    "planned=0",
    "showDay=0",
    "scheduleChange=0",
    "posted=0",
    "skipped=0",
    "errors=1",
    `error=${error}`,
    "feed=unknown",
    "delivery=error",
    "sent=0",
    "expected=0",
  ].join(" ");
}

/** A 409 with this name means Resend already accepted this night's send. */
export function resendAlreadyAccepted(status: number, body: string): boolean {
  return status === 409 && body.includes("invalid_idempotent_request");
}

export function classifyAlertError(err: unknown): AlertErrorClass {
  const status = statusOf(err);
  const text = errorText(err);
  if (/ETIMEDOUT|timed out|timeout/i.test(text)) return "timeout";
  if (/not configured/i.test(text)) return "config";
  if (/Could not send the podcast alert|\bresend\b/i.test(text)) return "provider";
  if (status === 429 || (status >= 500 && status < 600)) return "provider";
  if (/fetch failed/i.test(text)) return "timeout";
  if (/libsql|turso|sqlite|postgres|database|ECONNRESET|ENOTFOUND|getaddrinfo/i.test(text)) {
    return "database";
  }
  return "unknown";
}

function statusOf(err: unknown): number {
  if (!err || typeof err !== "object" || !("status" in err)) return NaN;
  return Number(err.status);
}

function errorText(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      if ("code" in current && current.code) parts.push(String(current.code));
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" ");
}

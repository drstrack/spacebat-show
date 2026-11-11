import { timingSafeEqual } from "node:crypto";

export type AlertRoute = "run" | "status";

type AlertAuthEnv = {
  CRON_SECRET?: string;
  ALERTS_STATUS_TOKEN?: string;
};

/**
 * True when `authorization` is exactly `Bearer <secret>`.
 * Length mismatches still run a compare so a short guess does not return early
 * past the secret's own bytes. The secret itself is never logged.
 */
export function bearerMatches(authorization: string, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(authorization, "utf8");
  if (expected.length !== actual.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(expected, actual);
}

/**
 * `/api/alerts/run` accepts only CRON_SECRET.
 * `/api/alerts/status` also accepts ALERTS_STATUS_TOKEN. An unset status token
 * changes nothing: status keeps accepting only the cron secret.
 */
export function authorizeAlertRoute(
  route: AlertRoute,
  authorization: string | null,
  env: AlertAuthEnv = process.env,
): boolean {
  const header = authorization ?? "";
  const cron = env.CRON_SECRET?.trim() ?? "";
  const cronOk = cron.length > 0 && header.length > 0 && bearerMatches(header, cron);
  if (route === "run") return cronOk;
  const token = env.ALERTS_STATUS_TOKEN?.trim() ?? "";
  const tokenOk = token.length > 0 && header.length > 0 && bearerMatches(header, token);
  return cronOk || tokenOk;
}

/** 401 when the bearer is missing or wrong. Null when the route may continue. */
export function alertAuthResponse(
  route: AlertRoute,
  request: Request,
  env: AlertAuthEnv = process.env,
): Response | null {
  if (authorizeAlertRoute(route, request.headers.get("authorization"), env)) return null;
  return new Response("No.", { status: 401 });
}

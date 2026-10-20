/** Distinct reporters required before a message is hidden. */
export const AUTO_HIDE_REPORT_COUNT = 3;

export const REPORTS_PER_HOUR = 10;
export const REPORT_WINDOW_MS = 60 * 60 * 1000;
export const PURGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MUTE_1H_MINUTES = 60;
export const MUTE_24H_MINUTES = 1440;

export const REPORT_REASONS = ["spam", "harassment", "personal-info", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const RESOLVE_ACTIONS = [
  "dismiss",
  "delete",
  "delete-and-mute",
  "delete-and-ban",
  "restore",
] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export function shouldAutoHide(distinctReporters: number): boolean {
  return distinctReporters >= AUTO_HIDE_REPORT_COUNT;
}

export function compileReport(
  reason: string,
  note: string,
): { ok: true; stored: string } | { ok: false; error: string } {
  if (!REPORT_REASONS.includes(reason as ReportReason)) {
    return { ok: false, error: "Pick a reason." };
  }
  const extra = note.trim().replace(/\s+/g, " ");
  if (extra.length > 200) return { ok: false, error: "Keep the note under 200 characters." };
  return { ok: true, stored: extra ? `${reason}: ${extra}` : reason };
}

export type SanctionActor = { userId: string; isAdmin: boolean };
export type SanctionTarget = { userId: string; isAdmin: boolean };

/**
 * Listeners cannot sanction anyone. An admin cannot mute or ban
 * themselves or another admin. Deleting a message is a separate check.
 */
export function canSanction(
  actor: SanctionActor,
  target: SanctionTarget,
): { ok: true } | { ok: false; error: string } {
  if (!actor.isAdmin) return { ok: false, error: "Crew only." };
  if (actor.userId === target.userId) return { ok: false, error: "You can't do that to yourself." };
  if (target.isAdmin) return { ok: false, error: "You can't do that to another admin." };
  return { ok: true };
}

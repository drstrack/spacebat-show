/**
 * One-off: the Wednesday, Oct 28, 2026 SpaceBat Show moves to
 * Thursday, Oct 29, 2026 at 8:30 PM America/New_York.
 *
 * The notice hides at the end of that day (2026-10-30 00:00 America/New_York).
 * The chat live banner treats 8:30–10:30 PM ET that Thursday as the show
 * window (the usual Podhome live item is two hours) and does not treat
 * Wednesday evening as that window. After the cutoff, delete this module
 * and its call sites. Wednesday behavior elsewhere is unchanged.
 */

export const SCHEDULE_CHANGE_NOTICE =
  "Schedule change: this week's live SpaceBat Show is Thursday, Oct 29 at 8:30 PM ET (not Wednesday).";

const TIME_ZONE = "America/New_York";

/** Wednesday night that was moved. Calendar date in America/New_York. */
const MOVED_FROM_DATE = "2026-10-28";

/** Inclusive show start: Thu Oct 29, 2026 8:30 PM America/New_York. */
const MOVED_SHOW_START_MS = zonedTimeToUtc(2026, 10, 29, 20, 30);

/** Exclusive show end: Thu Oct 29, 2026 10:30 PM America/New_York. */
const MOVED_SHOW_END_MS = zonedTimeToUtc(2026, 10, 29, 22, 30);

/** Exclusive cutoff: Fri Oct 30, 2026 00:00 America/New_York. */
export const SCHEDULE_CHANGE_ENDS_AT_MS = zonedTimeToUtc(2026, 10, 30, 0, 0);

export function scheduleChangeVisible(now: number | Date): boolean {
  return instant(now) < SCHEDULE_CHANGE_ENDS_AT_MS;
}

/**
 * Auto-mode live banner for this week only.
 * True during Thu Oct 29, 2026 8:30–10:30 PM America/New_York.
 * False on Wed Oct 28 (the night that was moved) and after the cutoff.
 */
export function liveBannerOverrideActive(now: number | Date): boolean {
  const t = instant(now);
  return t >= MOVED_SHOW_START_MS && t < MOVED_SHOW_END_MS;
}

export type LiveBannerSnapshot = {
  isLive: boolean;
  sinceMs: number | null;
  source: "stream" | "feed" | "manual" | null;
};

/**
 * While the Thursday window is open, Auto mode reports the room on air even
 * if the stream probe has not flipped yet. A real on-air state is left alone.
 * An active manual "off" still wins. Nothing is forced on Wednesday.
 */
export function applyLiveBannerOverride(
  live: LiveBannerSnapshot,
  manual: { mode: string | null; untilMs: number | null },
  now: number | Date,
): LiveBannerSnapshot {
  const t = instant(now);
  const manualOff = manual.mode === "off" && manual.untilMs != null && t < manual.untilMs;
  if (live.isLive || manualOff || !liveBannerOverrideActive(t)) return live;
  return { isLive: true, sinceMs: MOVED_SHOW_START_MS, source: null };
}

/** Shift a Podhome live item that is still set for Wed Oct 28 onto Thu Oct 29, 8:30 PM ET. */
export function applyScheduleChange<T extends { start: string }>(
  shows: T[],
  now: number | Date,
): T[] {
  if (!scheduleChangeVisible(now)) return shows;
  return shows.map((show) => {
    const start = new Date(show.start);
    if (Number.isNaN(start.getTime())) return show;
    if (nyDateKey(start) !== MOVED_FROM_DATE) return show;
    return { ...show, start: new Date(MOVED_SHOW_START_MS).toISOString() };
  });
}

function instant(now: number | Date): number {
  return typeof now === "number" ? now : now.getTime();
}

function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function zonedParts(utcMs: number) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(formatted.find((part) => part.type === type)?.value);
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour,
    minute: pick("minute"),
    second: pick("second"),
  };
}

/** UTC epoch for a wall-clock time in America/New_York. */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = zoneOffset(utcGuess);
  let utc = utcGuess - offset;
  const adjusted = zoneOffset(utc);
  if (adjusted !== offset) utc = utcGuess - adjusted;
  return utc;
}

function zoneOffset(utcMs: number): number {
  const parts = zonedParts(utcMs);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcMs;
}

/**
 * One-week moves of the live show. A future move is a new entry here.
 * Each entry expires on its own at midnight America/New_York on the day
 * after the moved show. Nothing in this list is written to the database.
 *
 * skipDate: the America/New_York calendar date that has no show.
 * showStart: the replacement start, with its ET offset (EST is -05:00).
 * note: the sentence the site and welcome mail show until the cutoff.
 * The live window is the two hours from showStart.
 */

export type ScheduleException = {
  skipDate: string;
  showStart: string;
  note: string;
};

export const scheduleExceptions: readonly ScheduleException[] = [
  {
    skipDate: "2026-11-04",
    showStart: "2026-11-05T20:30-05:00",
    note: "This week only: SpaceBat is live Thursday, Nov 5 at 8:30 PM ET.",
  },
];

export const ET = "America/New_York";

/** Podhome live items run two hours. 8:30 is included. 10:30 is not. */
export const SHOW_WINDOW_MS = 2 * 60 * 60 * 1000;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type ResolvedScheduleException = {
  skipDate: string;
  showStart: string;
  showStartMs: number;
  showEndMs: number;
  endsAtMs: number;
  showDate: string;
  note: string;
  showId: string;
};

export function americaNewYorkToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = zoneOffset(utcGuess);
  let utc = utcGuess - offset;
  const adjusted = zoneOffset(utc);
  if (adjusted !== offset) utc = utcGuess - adjusted;
  return utc;
}

export function resolveScheduleException(exception: ScheduleException): ResolvedScheduleException {
  if (!DATE_KEY.test(exception.skipDate)) {
    throw new Error(`schedule exception skipDate is not a calendar date: ${exception.skipDate}`);
  }
  const showStartMs = Date.parse(exception.showStart);
  if (!Number.isFinite(showStartMs)) {
    throw new Error(`schedule exception showStart is not a time: ${exception.showStart}`);
  }
  const note = exception.note.trim();
  if (!note) throw new Error("schedule exception note is empty");
  const showDate = nyDateKey(new Date(showStartMs));
  return {
    skipDate: exception.skipDate,
    showStart: exception.showStart,
    showStartMs,
    showEndMs: showStartMs + SHOW_WINDOW_MS,
    endsAtMs: midnightAfter(showDate),
    showDate,
    note,
    showId: `schedule-change-${showDate}`,
  };
}

/** The earliest exception that has not reached midnight ET after its show. */
export function activeScheduleException(now: number | Date): ResolvedScheduleException | null {
  const t = instant(now);
  const open = scheduleExceptions
    .map(resolveScheduleException)
    .filter((exception) => t < exception.endsAtMs)
    .sort((a, b) => a.showStartMs - b.showStartMs);
  return open[0] ?? null;
}

export function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nyWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "long",
  }).format(date);
}

export function nyMonthDay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    month: "long",
    day: "numeric",
  }).format(date);
}

export function instant(now: number | Date): number {
  return typeof now === "number" ? now : now.getTime();
}

/** Midnight ET on the calendar day after an America/New_York date key. */
function midnightAfter(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return americaNewYorkToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0);
}

function zonedParts(utcMs: number) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
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

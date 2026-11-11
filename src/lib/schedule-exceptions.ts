/**
 * One-off moves and cancellations of the live show.
 *
 * The standing show is Wednesday at 8:30 PM America/New_York. Ordinary weeks
 * need nothing in this list and nothing in the database. A move or a
 * cancellation is a row in show_schedule_override, edited by an admin at
 * /admin/schedule. This array stays empty; it is only the default argument
 * so a caller with no rows behaves like a regular week. Each row expires on
 * its own at midnight America/New_York on the day after the later of the
 * skipped date and the replacement show.
 *
 * skipDate: the America/New_York calendar date that has no show.
 * showStart: the replacement start (ISO), or null when the night is cancelled.
 * note: the sentence the site and welcome mail show until the cutoff.
 * The live window is the two hours from showStart. A cancellation has none.
 */

export type ScheduleException = {
  skipDate: string;
  showStart: string | null;
  note: string;
};

export const scheduleExceptions: readonly ScheduleException[] = [];

export const ET = "America/New_York";

/** Podhome live items run two hours. 8:30 is included. 10:30 is not. */
export const SHOW_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Show-day and skip-morning mail is attempted on the hourly cron while
 * America/New_York is in this inclusive hour range: 7:15, 8:15, 9:15, 10:15,
 * and 11:15. Noon is the cutoff a monitor uses, not another send attempt.
 */
export const ALERT_MORNING_START_HOUR = 7;
export const ALERT_MORNING_END_HOUR = 11;
export const ALERT_CUTOFF_HOUR = 12;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type ResolvedScheduleException = {
  skipDate: string;
  showStart: string | null;
  showStartMs: number | null;
  showEndMs: number | null;
  endsAtMs: number;
  showDate: string | null;
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
  const note = exception.note.trim();
  if (!note) throw new Error("schedule exception note is empty");
  if (exception.showStart == null) {
    return {
      skipDate: exception.skipDate,
      showStart: null,
      showStartMs: null,
      showEndMs: null,
      endsAtMs: midnightAfter(exception.skipDate),
      showDate: null,
      note,
      showId: `schedule-cancel-${exception.skipDate}`,
    };
  }
  const showStartMs = Date.parse(exception.showStart);
  if (!Number.isFinite(showStartMs)) {
    throw new Error(`schedule exception showStart is not a time: ${exception.showStart}`);
  }
  const showDate = nyDateKey(new Date(showStartMs));
  const lastDate = showDate > exception.skipDate ? showDate : exception.skipDate;
  return {
    skipDate: exception.skipDate,
    showStart: exception.showStart,
    showStartMs,
    showEndMs: showStartMs + SHOW_WINDOW_MS,
    endsAtMs: midnightAfter(lastDate),
    showDate,
    note,
    showId: `schedule-change-${showDate}`,
  };
}

/** Exceptions that have not reached midnight ET after their last relevant day. */
export function openScheduleExceptions(
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): ResolvedScheduleException[] {
  const t = instant(now);
  const open: ResolvedScheduleException[] = [];
  for (const exception of exceptions) {
    let resolved: ResolvedScheduleException;
    try {
      resolved = resolveScheduleException(exception);
    } catch {
      continue;
    }
    if (t < resolved.endsAtMs) open.push(resolved);
  }
  open.sort((a, b) => rank(a) - rank(b));
  return open;
}

/** The earliest exception that has not reached its cutoff. */
export function activeScheduleException(
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): ResolvedScheduleException | null {
  return openScheduleExceptions(now, exceptions)[0] ?? null;
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

export function nyHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  const value = Number(hour);
  return value === 24 ? 0 : value;
}

/** Noon on that America/New_York date falls on Wednesday. */
export function isWednesdayDate(dateKey: string): boolean {
  if (!DATE_KEY.test(dateKey)) return false;
  const [year, month, day] = dateKey.split("-").map(Number);
  const noon = americaNewYorkToUtc(year!, month!, day!, 12, 0);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
  }).format(new Date(noon));
  return weekday === "Wed";
}

export function inAlertMorning(now: number | Date): boolean {
  const hour = nyHour(new Date(instant(now)));
  return hour >= ALERT_MORNING_START_HOUR && hour <= ALERT_MORNING_END_HOUR;
}

/** True from noon America/New_York through the end of that calendar day. */
export function pastAlertCutoff(now: number | Date): boolean {
  return nyHour(new Date(instant(now))) >= ALERT_CUTOFF_HOUR;
}

/** 8:30 PM America/New_York on a calendar date, as a UTC ISO string. */
export function standingShowStart(dateKey: string): string {
  if (!DATE_KEY.test(dateKey)) throw new Error(`not a calendar date: ${dateKey}`);
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(americaNewYorkToUtc(year!, month!, day!, 20, 30)).toISOString();
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

function rank(exception: ResolvedScheduleException): number {
  return exception.showStartMs ?? Date.parse(`${exception.skipDate}T12:00:00Z`);
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

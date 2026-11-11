/** Validate a one-off move or cancellation before it is stored. No database. */

import {
  americaNewYorkToUtc,
  nyMonthDay,
  nyWeekday,
  resolveScheduleException,
  ET,
  type ScheduleException,
} from "./schedule-exceptions.ts";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX = 280;

export type ScheduleOverrideInput = {
  skipDate: string;
  cancelled: boolean;
  showDate: string;
  hour: number;
  minute: number;
  note: string;
};

export function parseScheduleOverride(input: ScheduleOverrideInput): ScheduleException {
  const skipDate = input.skipDate.trim();
  if (!isCalendarDate(skipDate)) throw new Error("Use a real calendar date.");
  if (input.cancelled) {
    const note = cleanNote(input.note, suggestedCancelNote(skipDate));
    return { skipDate, showStart: null, note };
  }
  const showDate = input.showDate.trim();
  if (!isCalendarDate(showDate)) throw new Error("Use a real show date.");
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("Use an hour from 0 to 23.");
  }
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    throw new Error("Use a minute from 0 to 59.");
  }
  const [year, month, day] = showDate.split("-").map(Number);
  const showStart = new Date(
    americaNewYorkToUtc(year!, month!, day!, input.hour, input.minute),
  ).toISOString();
  const note = cleanNote(input.note, suggestedMoveNote(showStart));
  return { skipDate, showStart, note };
}

export function suggestedMoveNote(showStartIso: string): string {
  const when = new Date(showStartIso);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
  return `This week only: SpaceBat is live ${nyWeekday(when)}, ${nyMonthDay(when)} at ${time} ET.`;
}

export function suggestedCancelNote(skipDate: string): string {
  const [year, month, day] = skipDate.split("-").map(Number);
  const noon = new Date(americaNewYorkToUtc(year!, month!, day!, 12, 0));
  return `This week only: no live SpaceBat show on ${nyMonthDay(noon)}.`;
}

/** Null when the candidate does not reuse a date from a different row. */
export function overrideConflicts(
  candidate: ScheduleException,
  existing: readonly ScheduleException[],
): string | null {
  let resolved;
  try {
    resolved = resolveScheduleException(candidate);
  } catch {
    return "That schedule change isn't valid.";
  }
  const dates = new Set([resolved.skipDate, resolved.showDate].filter((date): date is string => !!date));
  for (const row of existing) {
    if (row.skipDate === candidate.skipDate) continue;
    let other;
    try {
      other = resolveScheduleException(row);
    } catch {
      continue;
    }
    const used = [other.skipDate, other.showDate].filter((date): date is string => !!date);
    if (used.some((date) => dates.has(date))) return "That date is already in another schedule change.";
  }
  return null;
}

export function scheduleExceptionFromRow(row: {
  skip_date: unknown;
  show_start: unknown;
  note: unknown;
}): ScheduleException | null {
  const skipDate = typeof row.skip_date === "string" ? row.skip_date : "";
  const note = typeof row.note === "string" ? row.note.trim() : "";
  if (!skipDate || !note) return null;
  const showStart = row.show_start == null || row.show_start === "" ? null : instantToIso(row.show_start);
  if ((row.show_start != null && row.show_start !== "" && !showStart) || showStart === "") return null;
  const exception = { skipDate, showStart, note };
  try {
    resolveScheduleException(exception);
  } catch {
    return null;
  }
  return exception;
}

function cleanNote(note: string, fallback: string): string {
  const text = note.trim() || fallback;
  if (text.length > NOTE_MAX) throw new Error("Keep the note under 280 characters.");
  return text;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month! - 1 && utc.getUTCDate() === day;
}

function instantToIso(value: unknown): string | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : value.toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

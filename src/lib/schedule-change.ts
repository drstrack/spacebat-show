/**
 * Applies schedule exceptions to the notice, the chat live banner, welcome
 * mail, and podcast alerts. Rows come from show_schedule_override. The
 * default list is empty, which is a regular Wednesday. An exception expires
 * at midnight ET the day after the later of the skipped date and the moved
 * show, with no deploy.
 *
 * Podcast alerts, and only podcast alerts, also:
 * - on the skipped morning, during the morning window, send one
 *   "No live show tonight" note
 * - on the replacement morning, send one "We're on today"
 * A cancellation has no replacement morning. The Thursday (or other moved)
 * reminder stays kind "show-day", so the two notes cannot dedupe into each
 * other, and a night never produces two reminders.
 */

import {
  activeScheduleException,
  inAlertMorning,
  instant,
  isWednesdayDate,
  nyDateKey,
  nyMonthDay,
  nyWeekday,
  openScheduleExceptions,
  type ResolvedScheduleException,
  type ScheduleException,
  scheduleExceptions,
} from "./schedule-exceptions.ts";

export const SCHEDULE_CHANGE_ALERT_KIND = "schedule-change";

export function scheduleChangeNote(
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): string | null {
  return activeScheduleException(now, exceptions)?.note ?? null;
}

export function scheduleChangeVisible(
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): boolean {
  return activeScheduleException(now, exceptions) != null;
}

/**
 * Auto-mode live banner. True only inside the moved show's two-hour window.
 * False on the skipped night, on a cancellation, and after the cutoff.
 */
export function liveBannerOverrideActive(
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): boolean {
  const active = activeScheduleException(now, exceptions);
  if (!active || active.showStartMs == null || active.showEndMs == null) return false;
  const t = instant(now);
  return t >= active.showStartMs && t < active.showEndMs;
}

export type LiveBannerSnapshot = {
  isLive: boolean;
  sinceMs: number | null;
  source: "stream" | "feed" | "manual" | null;
};

/**
 * While the moved window is open, Auto mode reports the room on air even
 * if the stream probe has not flipped yet. A real on-air state is left alone.
 * An active manual "off" still wins. The skipped night is not forced on.
 */
export function applyLiveBannerOverride(
  live: LiveBannerSnapshot,
  manual: { mode: string | null; untilMs: number | null },
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): LiveBannerSnapshot {
  const active = activeScheduleException(now, exceptions);
  const t = instant(now);
  const manualOff = manual.mode === "off" && manual.untilMs != null && t < manual.untilMs;
  if (
    !active ||
    active.showStartMs == null ||
    active.showEndMs == null ||
    live.isLive ||
    manualOff ||
    t < active.showStartMs ||
    t >= active.showEndMs
  ) {
    return live;
  }
  return { isLive: true, sinceMs: active.showStartMs, source: null };
}

/** Move a Podhome live item that is still set for the skipped date onto the new start. */
export function applyScheduleChange<T extends { start: string }>(
  shows: T[],
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): T[] {
  const active = activeScheduleException(now, exceptions);
  if (!active || active.showStartMs == null) return shows;
  const start = new Date(active.showStartMs).toISOString();
  return shows.map((show) => {
    const when = new Date(show.start);
    if (Number.isNaN(when.getTime())) return show;
    if (nyDateKey(when) !== active.skipDate) return show;
    return { ...show, start };
  });
}

type AlertShow = { id: string; title: string; start: string };

/**
 * Alert schedule while an exception is open. One show on the moved night:
 * the Podhome item already on that date, else the skipped-date item shifted
 * forward, else one synthetic show. A cancellation drops the skipped night
 * and adds nothing. Other nights are left alone. After the cutoff, returns
 * shows unchanged. Call this from podcast alerts only.
 */
export function showsForAlertSchedule<T extends AlertShow>(
  shows: T[],
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): T[] {
  const active = activeScheduleException(now, exceptions);
  if (!active) return shows;
  if (active.showStartMs == null) {
    return shows.filter((show) => {
      const when = new Date(show.start);
      if (Number.isNaN(when.getTime())) return true;
      return nyDateKey(when) !== active.skipDate;
    });
  }
  const start = new Date(active.showStartMs).toISOString();
  const kept: T[] = [];
  let moved: T | null = null;
  let already: T | null = null;
  for (const show of shows) {
    const when = new Date(show.start);
    if (Number.isNaN(when.getTime())) {
      kept.push(show);
      continue;
    }
    const day = nyDateKey(when);
    if (day === active.showDate) {
      if (!already) already = show;
      continue;
    }
    if (day === active.skipDate) {
      if (!moved) moved = { ...show, start };
      continue;
    }
    kept.push(show);
  }
  const night = already ?? moved ?? (syntheticShow(active) as T);
  return [...kept, night];
}

export type ScheduleChangeAlert = {
  kind: typeof SCHEDULE_CHANGE_ALERT_KIND;
  ref: string;
  subject: string;
  text: string;
};

export type AlertDayPlan =
  | { kind: "schedule-change"; exception: ResolvedScheduleException }
  | { kind: "show-day"; date: string; exception: ResolvedScheduleException | null };

/**
 * What this America/New_York date should mail, ignoring the hour. A skip
 * whose replacement is a different day is only the "No live show" note.
 * A replacement day, or a Wednesday with no skip, is one "We're on today".
 */
export function alertDayPlan(
  now: number | Date,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): AlertDayPlan | null {
  const date = new Date(instant(now));
  const today = nyDateKey(date);
  const open = openScheduleExceptions(date, exceptions);
  const skip = open.find((exception) => exception.skipDate === today && exception.showDate !== today);
  if (skip) return { kind: "schedule-change", exception: skip };
  const moved = open.find((exception) => exception.showDate === today);
  if (moved) return { kind: "show-day", date: today, exception: moved };
  if (isWednesdayDate(today)) return { kind: "show-day", date: today, exception: null };
  return null;
}

/**
 * One note on the morning of the skipped date (same window as the show-day
 * reminder). Null on the moved morning, outside that window, and after the
 * cutoff. The caller logs kind "schedule-change" and ref skipDate.
 */
export function scheduleChangeMorningAlert(
  now: number | Date,
  site: string,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): ScheduleChangeAlert | null {
  if (!inAlertMorning(now)) return null;
  const plan = alertDayPlan(now, exceptions);
  if (!plan || plan.kind !== "schedule-change") return null;
  const active = plan.exception;
  const home = site.replace(/\/$/, "");
  if (active.showStartMs == null || active.showDate == null) {
    const resume = resumeLabel(active.skipDate);
    return {
      kind: SCHEDULE_CHANGE_ALERT_KIND,
      ref: active.skipDate,
      subject: "No live show tonight",
      text:
        `No live show tonight.\n\n` +
        `${active.note}\n\n` +
        `Regular Wednesday 8:30 PM ET shows resume ${resume}.\n\n` +
        `You asked for these notes. Turn them off anytime:\n${home}/account\n`,
    };
  }
  const when = new Date(active.showStartMs);
  const weekday = nyWeekday(when);
  const resume = resumeLabel(active.skipDate);
  return {
    kind: SCHEDULE_CHANGE_ALERT_KIND,
    ref: active.skipDate,
    subject: "No live show tonight",
    text:
      `No live show tonight, see you ${weekday}.\n\n` +
      `${active.note}\n\n` +
      `Regular Wednesday 8:30 PM ET shows resume ${resume}.\n\n` +
      `Come listen with us ${weekday}:\n${home}/podcast#live\n\n` +
      `You asked for these notes. Turn them off anytime:\n${home}/account\n`,
  };
}

function syntheticShow(active: ResolvedScheduleException): AlertShow {
  return {
    id: active.showId,
    title: "The SpaceBat Show",
    start: new Date(active.showStartMs!).toISOString(),
  };
}

/** The standing Wednesday a week after the skipped date. */
function resumeLabel(skipDate: string): string {
  const [year, month, day] = skipDate.split("-").map(Number);
  const nextWeek = new Date(Date.UTC(year!, month! - 1, day! + 7, 12));
  return nyMonthDay(nextWeek);
}

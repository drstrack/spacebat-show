/**
 * Applies src/lib/schedule-exceptions.ts to the notice, the chat live
 * banner, welcome mail, and podcast alerts. A future one-week move is a
 * new entry in that list. Expired entries drop out at midnight ET the day
 * after the moved show, with no deploy.
 *
 * Podcast alerts, and only podcast alerts, also:
 * - move a Podhome pending item dated on skipDate onto showStart
 * - if that night is still empty, add one synthetic show
 * - on the skipped morning, 7–10 AM ET, send one schedule-change note
 * The Thursday reminder stays kind "show-day", so the two notes cannot
 * dedupe into each other, and a night never produces two reminders.
 */

import {
  activeScheduleException,
  instant,
  nyDateKey,
  nyMonthDay,
  nyWeekday,
  type ResolvedScheduleException,
} from "./schedule-exceptions.ts";

export const SCHEDULE_CHANGE_ALERT_KIND = "schedule-change";

export function scheduleChangeNote(now: number | Date): string | null {
  return activeScheduleException(now)?.note ?? null;
}

export function scheduleChangeVisible(now: number | Date): boolean {
  return activeScheduleException(now) != null;
}

/**
 * Auto-mode live banner. True only inside the moved show's two-hour window.
 * False on the skipped night and after the cutoff.
 */
export function liveBannerOverrideActive(now: number | Date): boolean {
  const active = activeScheduleException(now);
  if (!active) return false;
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
): LiveBannerSnapshot {
  const active = activeScheduleException(now);
  const t = instant(now);
  const manualOff = manual.mode === "off" && manual.untilMs != null && t < manual.untilMs;
  if (!active || live.isLive || manualOff || t < active.showStartMs || t >= active.showEndMs) {
    return live;
  }
  return { isLive: true, sinceMs: active.showStartMs, source: null };
}

/** Move a Podhome live item that is still set for the skipped date onto the new start. */
export function applyScheduleChange<T extends { start: string }>(
  shows: T[],
  now: number | Date,
): T[] {
  const active = activeScheduleException(now);
  if (!active) return shows;
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
 * forward, else one synthetic show. Other nights are left alone. After the
 * cutoff, returns shows unchanged. Call this from podcast alerts only.
 */
export function showsForAlertSchedule<T extends AlertShow>(shows: T[], now: number | Date): T[] {
  const active = activeScheduleException(now);
  if (!active) return shows;
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

/**
 * One note on the morning of the skipped date (7–10 AM ET, same window as
 * the show-day reminder). Null on the moved morning, outside that window,
 * and after the cutoff. The caller logs kind "schedule-change" and ref
 * skipDate, independent of whether Podhome has a live item.
 */
export function scheduleChangeMorningAlert(
  now: number | Date,
  site: string,
): ScheduleChangeAlert | null {
  const active = activeScheduleException(now);
  if (!active || !skippedMorning(active, now)) return null;
  const home = site.replace(/\/$/, "");
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
    start: new Date(active.showStartMs).toISOString(),
  };
}

function skippedMorning(active: ResolvedScheduleException, now: number | Date): boolean {
  const date = typeof now === "number" ? new Date(now) : now;
  if (nyDateKey(date) !== active.skipDate) return false;
  const hour = nyHour(date);
  return hour >= 7 && hour <= 10;
}

/** The standing Wednesday a week after the skipped date. */
function resumeLabel(skipDate: string): string {
  const [year, month, day] = skipDate.split("-").map(Number);
  const nextWeek = new Date(Date.UTC(year!, month! - 1, day! + 7, 12));
  return nyMonthDay(nextWeek);
}

function nyHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  const value = Number(hour);
  return value === 24 ? 0 : value;
}

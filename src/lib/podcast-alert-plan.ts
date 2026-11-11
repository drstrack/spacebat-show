/** Pure schedule rules for podcast-alert mail. No database. */

import {
  alertDayPlan,
  scheduleChangeMorningAlert,
  showsForAlertSchedule,
  type ScheduleChangeAlert,
} from "./schedule-change.ts";
import {
  inAlertMorning,
  nyDateKey,
  standingShowStart,
  type ScheduleException,
  scheduleExceptions,
} from "./schedule-exceptions.ts";

const NY = "America/New_York";
const STREAM_HOST = "stream.podhome.fm";
const DEFAULT_TITLE = "The SpaceBat Show";

export type ScheduledShow = {
  id: string;
  title: string;
  start: string;
};

export type PostedShow = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
};

export function parseScheduledShows(xml: string): ScheduledShow[] {
  const shows: ScheduledShow[] = [];
  for (const block of collect(xml, "podcast:liveItem")) {
    const open = block.match(/<podcast:liveItem\b[^>]*>/i)?.[0] ?? "";
    if (!/status="pending"/i.test(open)) continue;
    const start = attr(open, "start");
    const when = new Date(start);
    if (!start || Number.isNaN(when.getTime())) continue;
    const id = text(block, "guid") || start;
    const title = decode(text(block, "title")) || "The SpaceBat Show";
    shows.push({ id, title, start: when.toISOString() });
  }
  return shows;
}

export function parsePostedShows(xml: string): PostedShow[] {
  const shows: PostedShow[] = [];
  const seen = new Set<string>();
  for (const block of collect(xml, "item")) {
    const audio = enclosureUrl(block);
    if (!audio || audio.includes(STREAM_HOST)) continue;
    const guid = text(block, "guid");
    const link = text(block, "link");
    const title = decode(text(block, "title")) || "The SpaceBat Show";
    const slug = slugFrom(link, title, guid);
    const id = guid || slug;
    if (seen.has(id)) continue;
    seen.add(id);
    const pub = text(block, "pubDate");
    const when = pub ? new Date(pub) : null;
    shows.push({
      id,
      title,
      slug,
      publishedAt: when && !Number.isNaN(when.getTime()) ? when.toISOString() : "",
    });
  }
  return shows;
}

/** Morning in New York, and the show starts that same calendar day. */
export function showsDueThisMorning(now: Date, shows: ScheduledShow[]): ScheduledShow[] {
  if (!inAlertMorning(now)) return [];
  const today = nyDateKey(now);
  return shows.filter((show) => nyDateKey(new Date(show.start)) === today);
}

export type AlertMail =
  | ScheduleChangeAlert
  | {
      kind: "show-day";
      ref: string;
      subject: string;
      text: string;
    };

/**
 * Morning podcast alerts for one cron run.
 *
 * With no exception, every Wednesday mails one "We're on today" for 8:30 PM
 * America/New_York. A Podhome pending item on that night replaces the title
 * and the start time, and cannot add a second mail. A null feed is an outage:
 * the default (or the override) still plans. The show-day ref is the
 * America/New_York date of the night, so a later Podhome guid or title cannot
 * double-send. The skipped morning uses kind "schedule-change".
 */
export function planAlertMorning(
  xml: string | null,
  now: Date,
  site: string,
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): {
  shows: ScheduledShow[];
  mails: AlertMail[];
} {
  const parsed = xml ? parseScheduledShows(xml) : [];
  const shows = showsForAlertSchedule(parsed, now, exceptions);
  const mails: AlertMail[] = [];
  const change = scheduleChangeMorningAlert(now, site, exceptions);
  if (change) mails.push(change);
  const night = showNightForMorning(now, parsed, exceptions);
  if (night) mails.push(showDayMail(night, site, night.id));
  return { shows, mails };
}

/**
 * The one show-night this morning should remind people about. Podhome items
 * only fill in title and start. Null when this morning is a skip, a
 * cancellation, or not a show morning.
 */
export function showNightForMorning(
  now: Date,
  podhome: readonly ScheduledShow[],
  exceptions: readonly ScheduleException[] = scheduleExceptions,
): ScheduledShow | null {
  if (!inAlertMorning(now)) return null;
  const plan = alertDayPlan(now, exceptions);
  if (!plan || plan.kind !== "show-day") return null;
  const today = plan.date;
  const baseStart =
    plan.exception?.showStartMs != null
      ? new Date(plan.exception.showStartMs).toISOString()
      : standingShowStart(today);
  const onNight = podhome.find((show) => sameNight(show, today));
  if (onNight) {
    return { id: today, title: onNight.title || DEFAULT_TITLE, start: onNight.start };
  }
  const skipDate = plan.exception?.skipDate;
  const onSkip = skipDate ? podhome.find((show) => sameNight(show, skipDate)) : undefined;
  return { id: today, title: onSkip?.title || DEFAULT_TITLE, start: baseStart };
}

export function showDayMail(show: ScheduledShow, site: string, ref?: string): AlertMail {
  const home = site.replace(/\/$/, "");
  const night = ref ?? nyDateKey(new Date(show.start));
  return {
    kind: "show-day",
    ref: night,
    subject: "We're on today",
    text:
      `John and Dan are live today. The bat signal is up.\n\n` +
      `${show.title}\n` +
      `${formatShowWhen(show.start)}\n\n` +
      `Come listen with us:\n${home}/podcast#live\n\n` +
      `You asked for these notes. Turn them off anytime:\n${home}/account\n`,
  };
}

export { nyDateKey };

export function formatShowWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function sameNight(show: ScheduledShow, dateKey: string): boolean {
  const when = new Date(show.start);
  if (Number.isNaN(when.getTime())) return false;
  return nyDateKey(when) === dateKey;
}

function collect(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(re) ?? [];
}

function text(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"),
  );
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return plain ? plain[1].trim() : "";
}

function enclosureUrl(block: string): string {
  const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0] ?? "";
  return attr(enclosure, "url");
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ? decode(match[1]) : "";
}

function slugFrom(link: string, title: string, guid: string): string {
  const fromLink = link.match(/episodepage\/[^/]+\/([^/?#]+)/i)?.[1];
  if (fromLink) return decodeURIComponent(fromLink);
  const fromTitle = title
    .toLowerCase()
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return fromTitle || guid.slice(0, 12) || "episode";
}

function decode(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'");
}

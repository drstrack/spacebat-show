import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLiveBannerOverride,
  applyScheduleChange,
  liveBannerOverrideActive,
  SCHEDULE_CHANGE_ALERT_KIND,
  SCHEDULE_CHANGE_ALERT_REF,
  SCHEDULE_CHANGE_ENDS_AT_MS,
  SCHEDULE_CHANGE_NOTICE,
  SCHEDULE_CHANGE_SHOW_ID,
  scheduleChangeMorningAlert,
  scheduleChangeVisible,
  showsForAlertSchedule,
  type LiveBannerSnapshot,
} from "./schedule-change.ts";
import { parseScheduledShows } from "./podcast-alert-plan.ts";

const quiet: LiveBannerSnapshot = { isLive: false, sinceMs: null, source: null };
const auto = { mode: null, untilMs: null };

test("cutoff is midnight at the end of Oct 29 in America/New_York", () => {
  assert.equal(new Date(SCHEDULE_CHANGE_ENDS_AT_MS).toISOString(), "2026-10-30T04:00:00.000Z");
  assert.equal(
    SCHEDULE_CHANGE_NOTICE,
    "Schedule change: this week's live SpaceBat Show is Thursday, Oct 29 at 8:30 PM ET (not Wednesday).",
  );
});

test("schedule notice is visible before the cutoff and hidden after", () => {
  assert.equal(scheduleChangeVisible(new Date("2026-10-25T16:00:00.000Z")), true);
  assert.equal(scheduleChangeVisible(new Date("2026-10-30T03:59:59.000Z")), true);
  assert.equal(scheduleChangeVisible(SCHEDULE_CHANGE_ENDS_AT_MS), false);
  assert.equal(scheduleChangeVisible(new Date("2026-10-30T04:00:00.000Z")), false);
  assert.equal(scheduleChangeVisible(new Date("2026-11-04T01:30:00.000Z")), false);
});

test("live banner override applies Thursday Oct 29 evening and not Wednesday Oct 28", () => {
  const wednesdayShow = new Date("2026-10-29T00:30:00.000Z");
  const thursdayShow = new Date("2026-10-30T00:30:00.000Z");
  const thursdayLate = new Date("2026-10-30T02:00:00.000Z");
  const thursdayOver = new Date("2026-10-30T02:30:00.000Z");

  assert.equal(liveBannerOverrideActive(wednesdayShow), false);
  assert.equal(liveBannerOverrideActive(new Date("2026-10-29T01:30:00.000Z")), false);
  assert.equal(liveBannerOverrideActive(new Date("2026-10-30T00:29:00.000Z")), false);
  assert.equal(liveBannerOverrideActive(thursdayShow), true);
  assert.equal(liveBannerOverrideActive(thursdayLate), true);
  assert.equal(liveBannerOverrideActive(thursdayOver), false);
  assert.equal(liveBannerOverrideActive(new Date("2026-11-05T01:30:00.000Z")), false);

  const wednesday = applyLiveBannerOverride(quiet, auto, wednesdayShow);
  assert.equal(wednesday.isLive, false);
  assert.equal(wednesday.sinceMs, null);

  const thursday = applyLiveBannerOverride(quiet, auto, thursdayShow);
  assert.equal(thursday.isLive, true);
  assert.equal(thursday.source, null);
  assert.equal(new Date(thursday.sinceMs!).toISOString(), "2026-10-30T00:30:00.000Z");

  const alreadyLive = applyLiveBannerOverride(
    { isLive: true, sinceMs: 111, source: "stream" },
    auto,
    thursdayShow,
  );
  assert.equal(alreadyLive.sinceMs, 111);
  assert.equal(alreadyLive.source, "stream");

  const heldOff = applyLiveBannerOverride(
    quiet,
    { mode: "off", untilMs: thursdayShow.getTime() + 60_000 },
    thursdayShow,
  );
  assert.equal(heldOff.isLive, false);
});

test("a Podhome item still set for Wed Oct 28 moves to Thu Oct 29 8:30 PM ET", () => {
  const shows = [
    { id: "this-week", title: "SpaceBat", start: "2026-10-29T00:30:00.000Z" },
    { id: "already", title: "Moved", start: "2026-10-30T00:30:00.000Z" },
    { id: "next", title: "November", start: "2026-11-05T01:30:00.000Z" },
  ];
  const during = applyScheduleChange(shows, new Date("2026-10-25T16:00:00.000Z"));
  assert.equal(during[0]?.start, "2026-10-30T00:30:00.000Z");
  assert.equal(during[1]?.start, "2026-10-30T00:30:00.000Z");
  assert.equal(during[2]?.start, "2026-11-05T01:30:00.000Z");

  const after = applyScheduleChange(shows, new Date("2026-10-30T04:00:00.000Z"));
  assert.equal(after[0]?.start, "2026-10-29T00:30:00.000Z");
});

const DURING = new Date("2026-10-27T16:00:00.000Z");
const AFTER = new Date("2026-10-30T04:00:00.000Z");
const THU_START = "2026-10-30T00:30:00.000Z";
const WED_START = "2026-10-29T00:30:00.000Z";

function feed(items: string) {
  return `<rss><channel>${items}</channel></rss>`;
}

function pending(guid: string, start: string, title = "Podhome title") {
  return (
    `<podcast:liveItem status="pending" start="${start}">` +
    `<title>${title}</title><guid>${guid}</guid></podcast:liveItem>`
  );
}

test("empty feed adds one synthetic Thursday show and never a Wednesday show", () => {
  const shows = showsForAlertSchedule(parseScheduledShows(feed("")), DURING);
  assert.equal(shows.length, 1);
  assert.deepEqual(shows[0], {
    id: SCHEDULE_CHANGE_SHOW_ID,
    title: "The SpaceBat Show",
    start: THU_START,
  });
  assert.equal(showsForAlertSchedule(parseScheduledShows(feed("")), AFTER).length, 0);
});

test("a Wednesday-only feed shifts onto Thursday and is not duplicated", () => {
  const shows = showsForAlertSchedule(
    parseScheduledShows(feed(pending("live-wed", WED_START, "Moved night"))),
    DURING,
  );
  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.id, "live-wed");
  assert.equal(shows[0]?.title, "Moved night");
  assert.equal(shows[0]?.start, THU_START);
  assert.notEqual(shows[0]?.id, SCHEDULE_CHANGE_SHOW_ID);
});

test("a feed that already lists Thursday is unchanged", () => {
  const parsed = parseScheduledShows(feed(pending("live-thu", THU_START, "Already Thursday")));
  const shows = showsForAlertSchedule(parsed, DURING);
  assert.deepEqual(shows, parsed);
});

test("after the cutoff there is no synthetic show and no shift", () => {
  const parsed = parseScheduledShows(feed(pending("live-wed", WED_START)));
  const shows = showsForAlertSchedule(parsed, AFTER);
  assert.deepEqual(shows, parsed);
  assert.equal(shows[0]?.start, new Date(WED_START).toISOString());
  assert.equal(showsForAlertSchedule([], AFTER).length, 0);
});

test("Wednesday and Thursday items together do not grow a third show", () => {
  const parsed = parseScheduledShows(
    feed(pending("live-wed", WED_START) + pending("live-thu", THU_START)),
  );
  const shows = showsForAlertSchedule(parsed, DURING);
  assert.deepEqual(
    shows.map((show) => show.id),
    ["live-wed", "live-thu"],
  );
  assert.equal(shows[0]?.start, THU_START);
  assert.equal(shows[1]?.start, THU_START);
});

test("the Wednesday schedule-change note is one stable alert and is not the Thursday reminder", () => {
  const site = "https://www.spacebatshow.net";
  const morning = scheduleChangeMorningAlert(new Date("2026-10-28T12:00:00.000Z"), site);
  const later = scheduleChangeMorningAlert(new Date("2026-10-28T14:30:00.000Z"), site);
  assert.ok(morning);
  assert.equal(morning.kind, SCHEDULE_CHANGE_ALERT_KIND);
  assert.equal(morning.ref, SCHEDULE_CHANGE_ALERT_REF);
  assert.equal(morning.kind, "schedule-change");
  assert.notEqual(morning.kind, "show-day");
  assert.deepEqual(later, morning);
  assert.equal(morning.subject, "No live show tonight");
  assert.equal(
    morning.text,
    "No live show tonight (Wednesday). John and Dan moved this week's show.\n\n" +
      "This week's live show is Thursday, Oct 29 at 8:30 PM ET. " +
      "Regular Wednesday 8:30 PM shows resume next week.\n\n" +
      "Come listen with us Thursday:\nhttps://www.spacebatshow.net/podcast#live\n\n" +
      "You asked for these notes. Turn them off anytime:\nhttps://www.spacebatshow.net/account\n",
  );

  assert.equal(scheduleChangeMorningAlert(new Date("2026-10-28T10:59:00.000Z"), site), null);
  assert.ok(scheduleChangeMorningAlert(new Date("2026-10-28T11:00:00.000Z"), site));
  assert.ok(scheduleChangeMorningAlert(new Date("2026-10-28T14:59:00.000Z"), site));
  assert.equal(scheduleChangeMorningAlert(new Date("2026-10-28T15:00:00.000Z"), site), null);
  assert.equal(scheduleChangeMorningAlert(new Date("2026-10-29T12:00:00.000Z"), site), null);
  assert.equal(scheduleChangeMorningAlert(AFTER, site), null);
  assert.equal(
    scheduleChangeMorningAlert(new Date("2026-10-28T12:00:00.000Z"), site)?.ref,
    later?.ref,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduledShows } from "./podcast-alert-plan.ts";
import {
  applyLiveBannerOverride,
  applyScheduleChange,
  liveBannerOverrideActive,
  SCHEDULE_CHANGE_ALERT_KIND,
  scheduleChangeMorningAlert,
  scheduleChangeNote,
  scheduleChangeVisible,
  showsForAlertSchedule,
  type LiveBannerSnapshot,
} from "./schedule-change.ts";
import { americaNewYorkToUtc, resolveScheduleException, scheduleExceptions } from "./schedule-exceptions.ts";

const quiet: LiveBannerSnapshot = { isLive: false, sinceMs: null, source: null };
const auto = { mode: null, untilMs: null };
const resolved = resolveScheduleException(scheduleExceptions[0]!);
const NOTE = "This week only: SpaceBat is live Thursday, Nov 5 at 8:30 PM ET.";

function at(month: number, day: number, hour: number, minute = 0) {
  return new Date(americaNewYorkToUtc(2026, month, day, hour, minute));
}

const DURING = at(11, 2, 12);
const AFTER = at(11, 6, 0);
const THU_START = "2026-11-06T01:30:00.000Z";
const WED_START = "2026-11-05T01:30:00.000Z";
const NEXT_WED = "2026-11-12T01:30:00.000Z";

test("the notice follows the open exception and is gone at midnight ET Nov 6", () => {
  assert.equal(scheduleChangeNote(DURING), NOTE);
  assert.equal(scheduleChangeVisible(at(11, 6, 0, 0)), false);
  assert.equal(scheduleChangeVisible(new Date(resolved.endsAtMs - 1)), true);
  assert.equal(scheduleChangeVisible(resolved.endsAtMs), false);
  assert.equal(scheduleChangeNote(AFTER), null);
});

test("live banner override is Thursday Nov 5 8:30–10:30 PM ET and not Wednesday Nov 4", () => {
  assert.equal(liveBannerOverrideActive(at(11, 4, 20, 30)), false);
  assert.equal(liveBannerOverrideActive(at(11, 4, 22, 0)), false);
  assert.equal(liveBannerOverrideActive(at(11, 5, 20, 29)), false);
  assert.equal(liveBannerOverrideActive(at(11, 5, 20, 30)), true);
  assert.equal(liveBannerOverrideActive(at(11, 5, 22, 29)), true);
  assert.equal(liveBannerOverrideActive(at(11, 5, 22, 30)), false);
  assert.equal(liveBannerOverrideActive(AFTER), false);
  assert.equal(liveBannerOverrideActive(at(11, 11, 20, 30)), false);

  const wednesday = applyLiveBannerOverride(quiet, auto, at(11, 4, 20, 30));
  assert.equal(wednesday.isLive, false);
  assert.equal(wednesday.sinceMs, null);

  const thursday = applyLiveBannerOverride(quiet, auto, at(11, 5, 20, 30));
  assert.equal(thursday.isLive, true);
  assert.equal(thursday.source, null);
  assert.equal(new Date(thursday.sinceMs!).toISOString(), THU_START);

  const alreadyLive = applyLiveBannerOverride(
    { isLive: true, sinceMs: 111, source: "stream" },
    auto,
    at(11, 5, 21, 0),
  );
  assert.equal(alreadyLive.sinceMs, 111);
  assert.equal(alreadyLive.source, "stream");

  const heldOff = applyLiveBannerOverride(
    quiet,
    { mode: "off", untilMs: at(11, 5, 20, 31).getTime() },
    at(11, 5, 20, 30),
  );
  assert.equal(heldOff.isLive, false);
});

test("a Podhome item still set for Wed Nov 4 moves to Thu Nov 5 8:30 PM ET", () => {
  const shows = [
    { id: "this-week", title: "SpaceBat", start: WED_START },
    { id: "already", title: "Moved", start: THU_START },
    { id: "next", title: "November 11", start: NEXT_WED },
  ];
  const during = applyScheduleChange(shows, DURING);
  assert.equal(during[0]?.start, THU_START);
  assert.equal(during[1]?.start, THU_START);
  assert.equal(during[2]?.start, NEXT_WED);

  const after = applyScheduleChange(shows, AFTER);
  assert.equal(after[0]?.start, WED_START);
});

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
    id: resolved.showId,
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
  assert.notEqual(shows[0]?.id, resolved.showId);
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

test("Wednesday and Thursday items together stay one show, the Thursday item", () => {
  const parsed = parseScheduledShows(
    feed(pending("live-wed", WED_START) + pending("live-thu", THU_START)),
  );
  const shows = showsForAlertSchedule(parsed, DURING);
  assert.deepEqual(
    shows.map((show) => show.id),
    ["live-thu"],
  );
  assert.equal(shows[0]?.start, THU_START);
});

test("next Wednesday is left on the calendar", () => {
  const parsed = parseScheduledShows(feed(pending("live-next", NEXT_WED, "Back to Wednesday")));
  const shows = showsForAlertSchedule(parsed, DURING);
  assert.equal(shows.length, 2);
  assert.equal(shows[0]?.id, "live-next");
  assert.equal(shows[0]?.start, new Date(NEXT_WED).toISOString());
  assert.equal(shows[1]?.id, resolved.showId);
});

test("the skipped Wednesday morning note is one stable alert and is not the Thursday reminder", () => {
  const site = "https://www.spacebatshow.net";
  const morning = scheduleChangeMorningAlert(at(11, 4, 8), site);
  const later = scheduleChangeMorningAlert(at(11, 4, 10, 30), site);
  assert.ok(morning);
  assert.equal(morning.kind, SCHEDULE_CHANGE_ALERT_KIND);
  assert.equal(morning.ref, "2026-11-04");
  assert.equal(morning.kind, "schedule-change");
  assert.notEqual(morning.kind, "show-day");
  assert.deepEqual(later, morning);
  assert.equal(morning.subject, "No live show tonight");
  assert.equal(
    morning.text,
    "No live show tonight, see you Thursday.\n\n" +
      `${NOTE}\n\n` +
      "Regular Wednesday 8:30 PM ET shows resume November 11.\n\n" +
      "Come listen with us Thursday:\nhttps://www.spacebatshow.net/podcast#live\n\n" +
      "You asked for these notes. Turn them off anytime:\nhttps://www.spacebatshow.net/account\n",
  );

  assert.equal(scheduleChangeMorningAlert(at(11, 4, 6, 59), site), null);
  assert.ok(scheduleChangeMorningAlert(at(11, 4, 7), site));
  assert.ok(scheduleChangeMorningAlert(at(11, 4, 10, 59), site));
  assert.equal(scheduleChangeMorningAlert(at(11, 4, 11), site), null);
  assert.equal(scheduleChangeMorningAlert(at(11, 5, 8), site), null);
  assert.equal(scheduleChangeMorningAlert(AFTER, site), null);
  assert.equal(scheduleChangeMorningAlert(at(11, 4, 8), site)?.ref, later?.ref);
});

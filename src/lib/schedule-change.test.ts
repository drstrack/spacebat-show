import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLiveBannerOverride,
  applyScheduleChange,
  liveBannerOverrideActive,
  SCHEDULE_CHANGE_ENDS_AT_MS,
  SCHEDULE_CHANGE_NOTICE,
  scheduleChangeVisible,
  type LiveBannerSnapshot,
} from "./schedule-change.ts";

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

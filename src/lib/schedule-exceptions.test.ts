import assert from "node:assert/strict";
import test from "node:test";
import {
  activeScheduleException,
  americaNewYorkToUtc,
  resolveScheduleException,
  scheduleExceptions,
  type ScheduleException,
} from "./schedule-exceptions.ts";

const nov5: ScheduleException = {
  skipDate: "2026-11-04",
  showStart: "2026-11-05T20:30-05:00",
  note: "This week only: SpaceBat is live Thursday, Nov 5 at 8:30 PM ET.",
};

test("shipped exceptions stay empty so a regular Wednesday needs no code change", () => {
  assert.deepEqual(scheduleExceptions, []);
});

test("November wall time is EST (UTC-5) and July wall time is EDT (UTC-4)", () => {
  assert.equal(americaNewYorkToUtc(2026, 11, 5, 20, 30), Date.parse("2026-11-06T01:30:00.000Z"));
  assert.equal(americaNewYorkToUtc(2026, 11, 6, 0, 0), Date.parse("2026-11-06T05:00:00.000Z"));
  assert.equal(americaNewYorkToUtc(2026, 11, 4, 20, 30), Date.parse("2026-11-05T01:30:00.000Z"));
  assert.equal(americaNewYorkToUtc(2026, 7, 15, 20, 30), Date.parse("2026-07-16T00:30:00.000Z"));
  assert.equal(americaNewYorkToUtc(2026, 7, 16, 0, 0), Date.parse("2026-07-16T04:00:00.000Z"));
  assert.equal(Date.parse(nov5.showStart!), americaNewYorkToUtc(2026, 11, 5, 20, 30));
});

test("the Nov 5 window is 8:30–10:30 PM ET and expires at midnight ET Nov 6", () => {
  const resolved = resolveScheduleException(nov5);
  assert.equal(resolved.showDate, "2026-11-05");
  assert.equal(resolved.showId, "schedule-change-2026-11-05");
  assert.equal(new Date(resolved.showStartMs!).toISOString(), "2026-11-06T01:30:00.000Z");
  assert.equal(new Date(resolved.showEndMs!).toISOString(), "2026-11-06T03:30:00.000Z");
  assert.equal(new Date(resolved.endsAtMs).toISOString(), "2026-11-06T05:00:00.000Z");
});

test("a summer exception expires at midnight EDT, not a fixed UTC-5 offset", () => {
  const july: ScheduleException = {
    skipDate: "2026-07-15",
    showStart: "2026-07-15T20:30-04:00",
    note: "This week only: SpaceBat is live Wednesday, Jul 15 at 8:30 PM ET.",
  };
  const resolved = resolveScheduleException(july);
  assert.equal(new Date(resolved.showStartMs!).toISOString(), "2026-07-16T00:30:00.000Z");
  assert.equal(new Date(resolved.endsAtMs).toISOString(), "2026-07-16T04:00:00.000Z");
  assert.notEqual(resolved.endsAtMs, Date.parse("2026-07-16T05:00:00.000Z"));
});

test("the notice is up before the live window, during it, and until midnight ET Nov 6", () => {
  const open = [nov5];
  const before = activeScheduleException(new Date("2026-11-01T22:00:00.000Z"), open);
  const wednesdayNight = activeScheduleException(new Date("2026-11-05T01:30:00.000Z"), open);
  const during = activeScheduleException(new Date("2026-11-06T01:30:00.000Z"), open);
  const afterShow = activeScheduleException(new Date("2026-11-06T03:30:00.000Z"), open);
  const lastMoment = activeScheduleException(new Date("2026-11-06T04:59:59.000Z"), open);
  assert.equal(before?.note, nov5.note);
  assert.equal(wednesdayNight?.showDate, "2026-11-05");
  assert.equal(during?.showStartMs, Date.parse("2026-11-06T01:30:00.000Z"));
  assert.ok(afterShow);
  assert.ok(lastMoment);
  assert.equal(activeScheduleException(new Date("2026-11-06T05:00:00.000Z"), open), null);
  assert.equal(activeScheduleException(Date.parse("2026-11-06T05:00:00.000Z"), open), null);
  assert.equal(activeScheduleException(new Date("2026-11-11T01:30:00.000Z")), null);
});

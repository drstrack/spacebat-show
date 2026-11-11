import assert from "node:assert/strict";
import test from "node:test";
import {
  overrideConflicts,
  parseScheduleOverride,
  scheduleExceptionFromRow,
  suggestedCancelNote,
  suggestedMoveNote,
} from "./schedule-overrides.ts";

test("a move stores 8:30 PM ET and a cancel stores no start", () => {
  const move = parseScheduleOverride({
    skipDate: "2026-11-18",
    cancelled: false,
    showDate: "2026-11-19",
    hour: 20,
    minute: 30,
    note: "",
  });
  assert.equal(move.showStart, "2026-11-20T01:30:00.000Z");
  assert.equal(move.note, suggestedMoveNote(move.showStart!));
  assert.match(move.note, /Thursday, November 19 at 8:30 PM ET/);

  const summer = parseScheduleOverride({
    skipDate: "2026-07-15",
    cancelled: false,
    showDate: "2026-07-16",
    hour: 20,
    minute: 30,
    note: "Custom note.",
  });
  assert.equal(summer.showStart, "2026-07-17T00:30:00.000Z");
  assert.equal(summer.note, "Custom note.");

  const cancel = parseScheduleOverride({
    skipDate: "2026-11-11",
    cancelled: true,
    showDate: "",
    hour: 20,
    minute: 30,
    note: "",
  });
  assert.equal(cancel.showStart, null);
  assert.equal(cancel.note, suggestedCancelNote("2026-11-11"));
});

test("rejects a bad date and a colliding night", () => {
  assert.throws(
    () =>
      parseScheduleOverride({
        skipDate: "2026-02-31",
        cancelled: true,
        showDate: "",
        hour: 20,
        minute: 30,
        note: "",
      }),
    /real calendar date/,
  );
  const existing = parseScheduleOverride({
    skipDate: "2026-11-18",
    cancelled: false,
    showDate: "2026-11-19",
    hour: 20,
    minute: 30,
    note: "Moved.",
  });
  const overlap = parseScheduleOverride({
    skipDate: "2026-11-19",
    cancelled: true,
    showDate: "",
    hour: 20,
    minute: 30,
    note: "Cancel.",
  });
  assert.equal(overrideConflicts(overlap, [existing]), "That date is already in another schedule change.");
  assert.equal(overrideConflicts(existing, [existing]), null);
});

test("reads a database row and drops a damaged one", () => {
  const move = scheduleExceptionFromRow({
    skip_date: "2026-11-18",
    show_start: new Date("2026-11-20T01:30:00.000Z"),
    note: "Thursday.",
  });
  assert.equal(move?.showStart, "2026-11-20T01:30:00.000Z");
  const cancel = scheduleExceptionFromRow({
    skip_date: "2026-11-11",
    show_start: null,
    note: "No show.",
  });
  assert.equal(cancel?.showStart, null);
  assert.equal(
    scheduleExceptionFromRow({ skip_date: "nope", show_start: null, note: "x" }),
    null,
  );
});

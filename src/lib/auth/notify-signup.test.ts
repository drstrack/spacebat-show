import assert from "node:assert/strict";
import test from "node:test";
import { welcomeText } from "./notify-signup.ts";

const HOME = "https://www.spacebatshow.net";

const STANDING =
  "Ada,\n\n" +
  "You're in. John and Dan are glad you made an account.\n\n" +
  "The show is live Wednesdays at 8:30pm EST:\n" +
  `${HOME}/podcast\n\n` +
  "Podcast alerts, the newsletter, and merch notes are on your account page:\n" +
  `${HOME}/account\n`;

const THIS_WEEK = "This week only: SpaceBat is live Thursday, Nov 5 at 8:30 PM ET.";

test("welcome mail keeps Wednesdays and adds this Thursday before the cutoff", () => {
  const during = welcomeText("Ada", HOME, new Date("2026-11-02T17:00:00.000Z"));
  assert.match(during, /The show is live Wednesdays at 8:30pm EST:/);
  assert.match(during, new RegExp(THIS_WEEK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(
    during,
    STANDING.replace(`${HOME}/podcast\n\n`, `${HOME}/podcast\n\n${THIS_WEEK}\n\n`),
  );
});

test("welcome mail drops the Thursday sentence after the cutoff", () => {
  const after = welcomeText("Ada", HOME, new Date("2026-11-06T05:00:00.000Z"));
  assert.equal(after, STANDING);
  assert.equal(after.includes("Thursday"), false);
  assert.equal(after.includes("Nov 5"), false);
});

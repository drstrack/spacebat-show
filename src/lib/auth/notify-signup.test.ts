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

test("welcome mail keeps Wednesdays and adds this Thursday before the cutoff", () => {
  const during = welcomeText("Ada", HOME, new Date("2026-10-27T16:00:00.000Z"));
  assert.match(during, /The show is live Wednesdays at 8:30pm EST:/);
  assert.match(during, /This week only, the show is Thursday, Oct 29 at 8:30 PM ET\./);
  assert.equal(
    during,
    STANDING.replace(
      `${HOME}/podcast\n\n`,
      `${HOME}/podcast\n\nThis week only, the show is Thursday, Oct 29 at 8:30 PM ET.\n\n`,
    ),
  );
});

test("welcome mail drops the Thursday sentence after the cutoff", () => {
  const after = welcomeText("Ada", HOME, new Date("2026-10-30T04:00:00.000Z"));
  assert.equal(after, STANDING);
  assert.equal(after.includes("Thursday"), false);
  assert.equal(after.includes("Oct 29"), false);
});

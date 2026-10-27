import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatShowWhen,
  parsePostedShows,
  parseScheduledShows,
  planAlertMorning,
  showsDueThisMorning,
} from "./podcast-alert-plan.ts";
import { SCHEDULE_CHANGE_SHOW_ID } from "./schedule-change.ts";

const FEED = `
<rss>
  <channel>
    <podcast:liveItem status="pending" start="2026-10-15T00:30:00Z" end="2026-10-15T02:30:00Z">
      <title>Wednesday night</title>
      <guid>live-1</guid>
    </podcast:liveItem>
    <podcast:liveItem status="ended" start="2026-10-08T00:30:00Z">
      <title>Already done</title>
      <guid>live-old</guid>
    </podcast:liveItem>
    <item>
      <title>Heartburn</title>
      <guid>ep-2</guid>
      <link>https://podhome.fm/episodepage/show/heartburn</link>
      <pubDate>Thu, 08 Oct 2026 04:23:31 +0000</pubDate>
      <enclosure url="https://serve.podhome.fm/episode/ep-2.mp3" />
    </item>
    <item>
      <title>Live mount</title>
      <guid>stream</guid>
      <enclosure url="https://stream.podhome.fm/the-spacebat-show" />
    </item>
  </channel>
</rss>`;

describe("podcast alert plan", () => {
  it("reads a pending Podhome live item and ignores an ended one", () => {
    const shows = parseScheduledShows(FEED);
    assert.deepEqual(
      shows.map((show) => show.id),
      ["live-1"],
    );
    assert.equal(shows[0]?.title, "Wednesday night");
  });

  it("reads posted episodes and skips the live stream mount", () => {
    const posted = parsePostedShows(FEED);
    assert.deepEqual(
      posted.map((episode) => episode.slug),
      ["heartburn"],
    );
  });

  it("reminds only on the morning of the scheduled New York day", () => {
    const shows = parseScheduledShows(FEED);
    const morning = new Date("2026-10-14T12:00:00Z");
    const afternoon = new Date("2026-10-14T20:00:00Z");
    const nextMorning = new Date("2026-10-15T12:00:00Z");
    assert.equal(showsDueThisMorning(morning, shows).length, 1);
    assert.equal(showsDueThisMorning(afternoon, shows).length, 0);
    assert.equal(showsDueThisMorning(nextMorning, shows).length, 0);
    assert.match(formatShowWhen(shows[0]!.start), /8:30/);
  });
});

const SITE = "https://www.spacebatshow.net";
const THU_START = "2026-10-30T00:30:00.000Z";
const WED_START = "2026-10-29T00:30:00.000Z";

function atEt(day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(2026, 9, day, hour + 4, minute, 0));
}

function pending(guid: string, start: string) {
  return (
    `<podcast:liveItem status="pending" start="${start}">` +
    `<title>The SpaceBat Show</title><guid>${guid}</guid></podcast:liveItem>`
  );
}

describe("this week's moved show", () => {
  const empty = "<rss><channel></channel></rss>";
  const wednesday = `<rss><channel>${pending("live-wed", WED_START)}</channel></rss>`;
  const thursday = `<rss><channel>${pending("live-thu", THU_START)}</channel></rss>`;

  it("adds nothing to showsDueThisMorning on Wednesday morning and one Thursday show the next morning", () => {
    for (const hour of [7, 8, 9, 10]) {
      const wed = atEt(28, hour);
      const wedPlan = planAlertMorning(empty, wed, SITE);
      assert.equal(showsDueThisMorning(wed, wedPlan.shows).length, 0);

      const thu = atEt(29, hour);
      const due = showsDueThisMorning(thu, planAlertMorning(empty, thu, SITE).shows);
      assert.equal(due.length, 1);
      assert.equal(due[0]?.id, SCHEDULE_CHANGE_SHOW_ID);
      assert.match(formatShowWhen(due[0]!.start), /Thursday/);
      assert.match(formatShowWhen(due[0]!.start), /8:30/);
      assert.match(formatShowWhen(due[0]!.start), /PM/);
    }
  });

  it("sends one schedule-change email on Wednesday morning and no We're on today", () => {
    for (const hour of [7, 8, 9, 10]) {
      for (const xml of [empty, wednesday, thursday]) {
        const mails = planAlertMorning(xml, atEt(28, hour), SITE).mails;
        assert.equal(mails.length, 1);
        assert.equal(mails[0]?.kind, "schedule-change");
        assert.equal(mails[0]?.ref, "2026-10-28");
        assert.equal(mails[0]?.subject, "No live show tonight");
        assert.equal(
          mails.filter((mail) => mail.subject === "We're on today" || mail.kind === "show-day")
            .length,
          0,
        );
      }
    }
    const early = planAlertMorning(empty, atEt(28, 6, 59), SITE).mails;
    const late = planAlertMorning(empty, atEt(28, 11), SITE).mails;
    assert.deepEqual(early, []);
    assert.deepEqual(late, []);
  });

  it("sends one We're on today for Thursday 8:30 PM and not the schedule-change note", () => {
    for (const xml of [empty, wednesday, thursday]) {
      for (const hour of [8, 9, 10]) {
        const mails = planAlertMorning(xml, atEt(29, hour), SITE).mails;
        assert.equal(mails.length, 1);
        assert.equal(mails[0]?.kind, "show-day");
        assert.equal(mails[0]?.subject, "We're on today");
        assert.match(mails[0]?.text ?? "", /Thursday/);
        assert.match(mails[0]?.text ?? "", /8:30/);
        assert.match(mails[0]?.text ?? "", /PM/);
        assert.equal(mails[0]?.text.includes("No live show tonight"), false);
      }
    }
    const fromEmpty = planAlertMorning(empty, atEt(29, 8), SITE).mails[0];
    assert.equal(fromEmpty?.ref, `${SCHEDULE_CHANGE_SHOW_ID}:${THU_START}`);
    const fromWednesday = planAlertMorning(wednesday, atEt(29, 8), SITE).mails[0];
    assert.equal(fromWednesday?.ref, `live-wed:${THU_START}`);
    const fromThursday = planAlertMorning(thursday, atEt(29, 8), SITE).mails[0];
    assert.equal(fromThursday?.ref, `live-thu:${THU_START}`);
  });

  it("sends neither email after the cutoff", () => {
    const fridayMorning = atEt(30, 8);
    for (const xml of [empty, wednesday, thursday]) {
      const plan = planAlertMorning(xml, fridayMorning, SITE);
      assert.deepEqual(plan.mails, []);
    }
    const wed = planAlertMorning(wednesday, fridayMorning, SITE);
    assert.equal(wed.shows.length, 1);
    assert.equal(wed.shows[0]?.start, new Date(WED_START).toISOString());
    assert.equal(
      planAlertMorning(empty, new Date("2026-10-30T04:00:00.000Z"), SITE).shows.length,
      0,
    );
  });
});

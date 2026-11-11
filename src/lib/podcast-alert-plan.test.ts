import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatShowWhen,
  parsePostedShows,
  parseScheduledShows,
  planAlertMorning,
  showsDueThisMorning,
} from "./podcast-alert-plan.ts";
import {
  americaNewYorkToUtc,
  resolveScheduleException,
  standingShowStart,
  type ScheduleException,
} from "./schedule-exceptions.ts";

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
const MOVED_WEEK: ScheduleException[] = [
  {
    skipDate: "2026-11-04",
    showStart: "2026-11-05T20:30-05:00",
    note: "This week only: SpaceBat is live Thursday, Nov 5 at 8:30 PM ET.",
  },
];
const MOVED = resolveScheduleException(MOVED_WEEK[0]!);
const THU_START = new Date(MOVED.showStartMs!).toISOString();
const WED_START = "2026-11-05T01:30:00.000Z";

function atEt(day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(2026, 10, day, hour + 5, minute, 0));
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
  const both = `<rss><channel>${pending("live-wed", WED_START)}${pending("live-thu", THU_START)}</channel></rss>`;

  it("adds nothing to showsDueThisMorning on Wednesday morning and one Thursday show the next morning", () => {
    for (const hour of [7, 8, 9, 10, 11]) {
      const wed = atEt(4, hour);
      const wedPlan = planAlertMorning(empty, wed, SITE, MOVED_WEEK);
      assert.equal(showsDueThisMorning(wed, wedPlan.shows).length, 0);

      const thu = atEt(5, hour);
      const due = showsDueThisMorning(thu, planAlertMorning(empty, thu, SITE, MOVED_WEEK).shows);
      assert.equal(due.length, 1);
      assert.equal(due[0]?.id, MOVED.showId);
      assert.match(formatShowWhen(due[0]!.start), /Thursday/);
      assert.match(formatShowWhen(due[0]!.start), /8:30/);
      assert.match(formatShowWhen(due[0]!.start), /PM/);
    }
  });

  it("sends one schedule-change email on Wednesday morning and no We're on today", () => {
    for (const hour of [7, 8, 9, 10, 11]) {
      for (const xml of [empty, wednesday, thursday, both]) {
        const mails = planAlertMorning(xml, atEt(4, hour), SITE, MOVED_WEEK).mails;
        assert.equal(mails.length, 1);
        assert.equal(mails[0]?.kind, "schedule-change");
        assert.equal(mails[0]?.ref, "2026-11-04");
        assert.equal(mails[0]?.subject, "No live show tonight");
        assert.match(mails[0]?.text ?? "", /see you Thursday/);
        assert.equal(
          mails.filter((mail) => mail.subject === "We're on today" || mail.kind === "show-day")
            .length,
          0,
        );
      }
    }
    const early = planAlertMorning(empty, atEt(4, 6, 59), SITE, MOVED_WEEK).mails;
    const late = planAlertMorning(empty, atEt(4, 12), SITE, MOVED_WEEK).mails;
    assert.deepEqual(early, []);
    assert.deepEqual(late, []);
  });

  it("sends one We're on today for Thursday 8:30 PM and not the schedule-change note", () => {
    for (const xml of [empty, wednesday, thursday, both]) {
      for (const hour of [8, 9, 10, 11]) {
        const mails = planAlertMorning(xml, atEt(5, hour), SITE, MOVED_WEEK).mails;
        assert.equal(mails.length, 1);
        assert.equal(mails[0]?.kind, "show-day");
        assert.equal(mails[0]?.subject, "We're on today");
        assert.match(mails[0]?.text ?? "", /Thursday/);
        assert.match(mails[0]?.text ?? "", /8:30/);
        assert.match(mails[0]?.text ?? "", /PM/);
        assert.equal(mails[0]?.text.includes("No live show tonight"), false);
      }
    }
    for (const xml of [empty, wednesday, thursday, both]) {
      assert.equal(planAlertMorning(xml, atEt(5, 8), SITE, MOVED_WEEK).mails[0]?.ref, "2026-11-05");
    }
  });

  it("sends neither email after the cutoff", () => {
    const fridayMorning = atEt(6, 8);
    for (const xml of [empty, wednesday, thursday, both]) {
      const plan = planAlertMorning(xml, fridayMorning, SITE, MOVED_WEEK);
      assert.deepEqual(plan.mails, []);
    }
    const wed = planAlertMorning(wednesday, fridayMorning, SITE, MOVED_WEEK);
    assert.equal(wed.shows.length, 1);
    assert.equal(wed.shows[0]?.start, new Date(WED_START).toISOString());
    assert.equal(planAlertMorning(empty, new Date("2026-11-06T05:00:00.000Z"), SITE, MOVED_WEEK).shows.length, 0);
  });
});

function morningOf(dateKey: string, hour = 8, minute = 15) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(americaNewYorkToUtc(year!, month!, day!, hour, minute));
}

function liveItem(guid: string, start: string, title: string) {
  return (
    `<rss><channel><podcast:liveItem status="pending" start="${start}">` +
    `<title>${title}</title><guid>${guid}</guid></podcast:liveItem></channel></rss>`
  );
}

describe("standing Wednesday", () => {
  it("mails one We're on today at 8:30 PM ET when Podhome has nothing", () => {
    const now = new Date("2026-11-11T14:19:00.000Z");
    const plan = planAlertMorning(null, now, SITE, []);
    assert.equal(plan.mails.length, 1);
    const mail = plan.mails[0];
    assert.equal(mail?.kind, "show-day");
    assert.equal(mail?.subject, "We're on today");
    assert.equal(mail?.ref, "2026-11-11");
    assert.match(mail?.text ?? "", /The SpaceBat Show/);
    assert.match(mail?.text ?? "", /Wednesday/);
    assert.match(mail?.text ?? "", /8:30/);
    assert.match(mail?.text ?? "", /PM EST/);
    assert.equal(standingShowStart("2026-11-11"), "2026-11-12T01:30:00.000Z");
  });

  it("lets one Podhome item change the title and time without a second mail", () => {
    const early = planAlertMorning(
      liveItem("ep-9", "2026-11-12T01:30:00.000Z", "Episode 9"),
      morningOf("2026-11-11"),
      SITE,
      [],
    );
    const later = planAlertMorning(
      liveItem("ep-9-b", "2026-11-12T02:00:00.000Z", "Episode 9 late"),
      morningOf("2026-11-11", 9),
      SITE,
      [],
    );
    assert.equal(early.mails.length, 1);
    assert.equal(later.mails.length, 1);
    assert.equal(early.mails[0]?.ref, "2026-11-11");
    assert.equal(later.mails[0]?.ref, early.mails[0]?.ref);
    assert.match(early.mails[0]?.text ?? "", /Episode 9/);
    assert.match(later.mails[0]?.text ?? "", /Episode 9 late/);
    assert.match(later.mails[0]?.text ?? "", /9:00/);
    assert.equal(later.mails.some((mail) => mail.kind === "schedule-change"), false);
  });

  it("ignores a Podhome item on a different day", () => {
    const wednesday = planAlertMorning(
      liveItem("thu", "2026-11-13T01:30:00.000Z", "Not tonight"),
      morningOf("2026-11-11"),
      SITE,
      [],
    );
    assert.equal(wednesday.mails.length, 1);
    assert.match(wednesday.mails[0]?.text ?? "", /The SpaceBat Show/);
    assert.match(wednesday.mails[0]?.text ?? "", /8:30/);
    assert.equal(wednesday.mails[0]?.text.includes("Not tonight"), false);
    const thursday = planAlertMorning(
      liveItem("thu", "2026-11-13T01:30:00.000Z", "Not tonight"),
      morningOf("2026-11-12"),
      SITE,
      [],
    );
    assert.deepEqual(thursday.mails, []);
  });

  it("keeps the same plan on a second run in the window", () => {
    const first = planAlertMorning(null, morningOf("2026-11-11", 7), SITE, []);
    const second = planAlertMorning(null, morningOf("2026-11-11", 11, 15), SITE, []);
    assert.deepEqual(second.mails, first.mails);
    assert.deepEqual(planAlertMorning(null, morningOf("2026-11-11", 6, 59), SITE, []).mails, []);
    assert.deepEqual(planAlertMorning(null, morningOf("2026-11-11", 12), SITE, []).mails, []);
  });

  it("uses 8:30 PM ET on both sides of the 2026 DST changes", () => {
    const weeks: Array<[string, string, RegExp]> = [
      ["2026-03-04", "2026-03-05T01:30:00.000Z", /EST/],
      ["2026-03-11", "2026-03-12T00:30:00.000Z", /EDT/],
      ["2026-07-15", "2026-07-16T00:30:00.000Z", /EDT/],
      ["2026-10-28", "2026-10-29T00:30:00.000Z", /EDT/],
      ["2026-11-04", "2026-11-05T01:30:00.000Z", /EST/],
      ["2026-11-11", "2026-11-12T01:30:00.000Z", /EST/],
    ];
    for (const [date, start, zone] of weeks) {
      assert.equal(standingShowStart(date), start);
      const mail = planAlertMorning(null, morningOf(date), SITE, []).mails[0];
      assert.equal(mail?.ref, date);
      assert.match(mail?.text ?? "", /Wednesday/);
      assert.match(mail?.text ?? "", /8:30/);
      assert.match(mail?.text ?? "", zone);
    }
  });
});

describe("one-off schedule data", () => {
  const move: ScheduleException = {
    skipDate: "2026-11-18",
    showStart: "2026-11-19T20:30:00-05:00",
    note: "This week only: SpaceBat is live Thursday, Nov 19 at 8:30 PM ET.",
  };
  const cancel: ScheduleException = {
    skipDate: "2026-11-11",
    showStart: null,
    note: "This week only: no live SpaceBat show on November 11.",
  };

  it("sends No live show on the skipped Wednesday and We're on today on Thursday", () => {
    const skipped = planAlertMorning(
      liveItem("wed", "2026-11-19T01:30:00.000Z", "Still Wednesday in Podhome"),
      morningOf("2026-11-18"),
      SITE,
      [move],
    );
    assert.equal(skipped.mails.length, 1);
    assert.equal(skipped.mails[0]?.kind, "schedule-change");
    assert.equal(skipped.mails[0]?.ref, "2026-11-18");
    assert.equal(skipped.mails[0]?.subject, "No live show tonight");
    assert.match(skipped.mails[0]?.text ?? "", /see you Thursday/);
    assert.match(skipped.mails[0]?.text ?? "", /8:30 PM ET/);
    assert.equal(skipped.mails.some((mail) => mail.kind === "show-day"), false);

    const moved = planAlertMorning(null, morningOf("2026-11-19"), SITE, [move]);
    assert.equal(moved.mails.length, 1);
    assert.equal(moved.mails[0]?.kind, "show-day");
    assert.equal(moved.mails[0]?.ref, "2026-11-19");
    assert.equal(moved.mails[0]?.subject, "We're on today");
    assert.match(moved.mails[0]?.text ?? "", /Thursday/);
    assert.match(moved.mails[0]?.text ?? "", /8:30/);
    assert.equal(moved.mails[0]?.text.includes("No live show tonight"), false);
  });

  it("sends only No live show tonight when the night is cancelled", () => {
    const skipped = planAlertMorning(
      liveItem("wed", "2026-11-12T01:30:00.000Z", "Episode 8"),
      morningOf("2026-11-11"),
      SITE,
      [cancel],
    );
    assert.equal(skipped.mails.length, 1);
    assert.equal(skipped.mails[0]?.kind, "schedule-change");
    assert.equal(skipped.mails[0]?.subject, "No live show tonight");
    assert.equal(skipped.mails[0]?.ref, "2026-11-11");
    assert.match(skipped.mails[0]?.text ?? "", /no live SpaceBat show on November 11/);
    assert.equal(skipped.mails.some((mail) => mail.kind === "show-day" || mail.subject === "We're on today"), false);
    assert.deepEqual(planAlertMorning(null, morningOf("2026-11-12"), SITE, [cancel]).mails, []);
  });
});

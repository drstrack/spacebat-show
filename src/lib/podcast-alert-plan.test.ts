import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatShowWhen,
  parsePostedShows,
  parseScheduledShows,
  showsDueThisMorning,
} from "./podcast-alert-plan.ts";

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
    assert.deepEqual(shows.map((show) => show.id), ["live-1"]);
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

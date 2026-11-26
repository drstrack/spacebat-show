import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePublishedEpisodes } from "./podcast-feed.ts";

describe("parsePublishedEpisodes episode numbers", () => {
  it("does not label a new episode 01 when itunes:episode is missing", () => {
    const episodes = parsePublishedEpisodes(
      feed([
        item({
          title: "Dan rides a Robotaxi in Texas, Claude at 2am, DC: The Future is The Past, Taxes",
          slug: "dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes",
          pub: "Wed, 25 Nov 2026 05:18:17 +0000",
          artwork: "https://assets.podhome.fm/show/SpaceBat%20Show%20Episode%209.jpg",
        }),
        item({
          title: "One Light-Day Away: Space, Superheroes, and ANT IPO AI Drama",
          slug: "one-light-day-away-space-superheroes-and-ant-ipo-ai-drama",
          pub: "Thu, 19 Nov 2026 05:31:13 +0000",
          episode: "8",
          artwork: "https://assets.podhome.fm/show/SpaceBat%20Show%20Episode%208.jpg",
        }),
        item({
          title: 'Vets - The Brave and the Bold, Jensen "Hung", DC Re-Loads, Tokenize "This"',
          slug: "vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this",
          pub: "Thu, 12 Nov 2026 05:09:47 +0000",
          episode: "7",
        }),
        item({
          title: "AI Meltdown, Europe Cracks, Gunn to Batman's Head, Quantum!?!",
          slug: "ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum",
          pub: "Fri, 6 Nov 2026 06:06:18 +0000",
          episode: "6",
        }),
        item({
          title: "Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die",
          slug: "einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die",
          pub: "Fri, 30 Oct 2026 03:56:30 +0000",
          episode: "5",
        }),
        item({
          title: "Nasdaq War Stories, Moon-Landing?, Fraud, AI Compute Crunch",
          slug: "nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch",
          pub: "Thu, 22 Oct 2026 04:27:45 +0000",
          episode: "4",
        }),
        item({
          title: "Highway to the Dangerzone",
          slug: "highway-to-the-dangerzone",
          pub: "Thu, 15 Oct 2026 04:01:18 +0000",
          episode: "3",
        }),
        item({
          title: "Heartburn, Hardware, and the Nuclear Triad",
          slug: "heartburn-hardware-and-the-nuclear-triad",
          pub: "Thu, 8 Oct 2026 04:23:31 +0000",
          episode: "2",
        }),
        item({
          title: "SpaceBat gets its Groove",
          slug: "spacebat-gets-its-groove",
          pub: "Fri, 2 Oct 2026 03:21:30 +0000",
          episode: "1",
        }),
        item({
          title: "Episode Zero: Grok Bots, Geopolitics, and the Bat Signal",
          slug: "episode-zero-grok-bots-geopolitics-and-the-bat-signal",
          pub: "Thu, 24 Sep 2026 03:46:13 +0000",
          artwork: "https://assets.podhome.fm/show/Episode-0-3000.jpg",
        }),
      ]),
    );

    assert.deepEqual(
      episodes.map((episode) => [episode.code, episode.slug]),
      [
        ["09", "dan-rides-a-robotaxi-in-texas-claude-at-2am-dc-the-future-is-the-past-taxes"],
        ["08", "one-light-day-away-space-superheroes-and-ant-ipo-ai-drama"],
        ["07", "vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this"],
        ["06", "ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum"],
        ["05", "einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die"],
        ["04", "nasdaq-war-stories-moon-landing-fraud-ai-compute-crunch"],
        ["03", "highway-to-the-dangerzone"],
        ["02", "heartburn-hardware-and-the-nuclear-triad"],
        ["01", "spacebat-gets-its-groove"],
        ["0", "episode-zero-grok-bots-geopolitics-and-the-bat-signal"],
      ],
    );
  });

  it("derives a missing number from the title or from pubDate order, without changing itunes numbers", () => {
    const fromTitle = parsePublishedEpisodes(
      feed([
        item({
          title: "Episode Nine Begins",
          slug: "episode-nine-begins",
          pub: "Wed, 25 Nov 2026 05:18:17 +0000",
        }),
        item({
          title: "A later show with a feed number",
          slug: "numbered-eight",
          pub: "Thu, 19 Nov 2026 05:31:13 +0000",
          episode: "8",
        }),
        item({
          title: "Episode Zero: The Pilot",
          slug: "episode-zero-the-pilot",
          pub: "Thu, 24 Sep 2026 03:46:13 +0000",
        }),
      ]),
    );
    assert.deepEqual(
      fromTitle.map((episode) => episode.code),
      ["09", "08", "0"],
    );

    const fromOrder = parsePublishedEpisodes(
      feed([
        item({
          title: "A new episode with no number anywhere",
          slug: "no-number-yet",
          pub: "Wed, 25 Nov 2026 05:18:17 +0000",
        }),
        item({
          title: "Numbered eight",
          slug: "numbered-eight",
          pub: "Thu, 19 Nov 2026 05:31:13 +0000",
          episode: "8",
        }),
        item({
          title: "Numbered seven",
          slug: "numbered-seven",
          pub: "Thu, 12 Nov 2026 05:09:47 +0000",
          episode: "7",
        }),
        item({
          title: "Episode Zero: The Pilot",
          slug: "episode-zero-the-pilot",
          pub: "Thu, 24 Sep 2026 03:46:13 +0000",
        }),
      ]),
    );
    assert.deepEqual(
      fromOrder.map((episode) => [episode.code, episode.slug]),
      [
        ["03", "no-number-yet"],
        ["08", "numbered-eight"],
        ["07", "numbered-seven"],
        ["0", "episode-zero-the-pilot"],
      ],
    );
  });
});

function feed(items: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss><channel>${items.join("")}</channel></rss>`;
}

function item(row: {
  title: string;
  slug: string;
  pub: string;
  episode?: string;
  artwork?: string;
}) {
  const episode = row.episode ? `<itunes:episode>${row.episode}</itunes:episode>` : "";
  const artwork = row.artwork ? `<itunes:image href="${row.artwork}" />` : "";
  return `<item>
    <title><![CDATA[${row.title}]]></title>
    <guid>https://example.test/${row.slug}</guid>
    <link>https://www.spacebatshow.net/episodepage/show/${row.slug}</link>
    <pubDate>${row.pub}</pubDate>
    <enclosure url="https://assets.podhome.fm/audio/${row.slug}.mp3" type="audio/mpeg" />
    ${episode}
    ${artwork}
  </item>`;
}

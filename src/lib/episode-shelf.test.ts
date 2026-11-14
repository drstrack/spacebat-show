import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  EPISODE_PAGE_SIZE,
  episodeShelfDomIds,
  episodeShelfHasMore,
  visibleEpisodeCount,
} from "./episode-shelf.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("episode shelf", () => {
  it("shows six episodes per batch and hides the control once the catalog fits", () => {
    assert.equal(EPISODE_PAGE_SIZE, 6);
    assert.equal(visibleEpisodeCount(8, 1), 6);
    assert.equal(episodeShelfHasMore(8, 1), true);
    assert.equal(visibleEpisodeCount(8, 2), 8);
    assert.equal(episodeShelfHasMore(8, 2), false);
    assert.equal(visibleEpisodeCount(5, 1), 5);
    assert.equal(episodeShelfHasMore(5, 1), false);
    assert.equal(visibleEpisodeCount(0, 1), 0);
    assert.equal(episodeShelfHasMore(0, 1), false);
    assert.equal(visibleEpisodeCount(20, 2), 12);
    assert.equal(episodeShelfHasMore(20, 2), true);
    assert.equal(episodeShelfHasMore(20, 4), false);
  });

  it("keeps the live anchor and puts More episodes at the bottom of the shelf", () => {
    const page = readFileSync(join(root, "src/routes/podcast.index.tsx"), "utf8");
    const shelf = readFileSync(join(root, "src/components/episode-shelf.tsx"), "utf8");
    assert.match(page, /id="live" className="[^"]*scroll-mt-20/);
    assert.match(page, /id="episodes" className="mt-14 scroll-mt-20"/);
    assert.match(page, /<EpisodeShelf episodes=\{episodes\} \/>/);
    assert.match(shelf, /More episodes/);
    assert.match(shelf, /type="button"/);
    assert.match(shelf, /aria-controls=\{ids\.listId\}/);
    assert.match(shelf, /episodeShelfHasMore/);
    assert.match(shelf, /preventScroll:\s*true/);
    assert.doesNotMatch(page, /hash="live"/);
    assert.doesNotMatch(page, /instanceId=/);
  });

  it("gives each shelf its own ids and keeps the podcast page on the original ones", () => {
    const podcast = episodeShelfDomIds();
    const detail = episodeShelfDomIds("more-episodes");
    assert.equal(podcast.listId, "episode-list");
    assert.equal(podcast.countId, "episode-shelf-count");
    assert.equal(podcast.cardId("launch-day"), "episode-card-launch-day");
    assert.equal(detail.listId, "more-episodes-list");
    assert.equal(detail.countId, "more-episodes-shelf-count");
    assert.equal(detail.cardId("launch-day"), "more-episodes-card-launch-day");
    assert.notEqual(podcast.listId, detail.listId);
    assert.notEqual(podcast.countId, detail.countId);
    assert.equal(episodeShelfDomIds("").listId, "episode-list");
    assert.equal(episodeShelfDomIds("more episodes").listId, "episode-list");
  });

  it("reuses the shelf under the episode the Play Latest Episode button opens", () => {
    const page = readFileSync(join(root, "src/routes/podcast.$slug.tsx"), "utf8");
    const listen = readFileSync(join(root, "src/routes/listen.tsx"), "utf8");
    assert.match(listen, /to: "\/podcast\/\$slug"/);
    assert.match(page, /item\.slug !== episode\.slug/);
    assert.doesNotMatch(page, /\.slice\(0,\s*4\)/);
    assert.match(page, /hash="episodes"/);
    assert.match(page, /All episodes/);
    assert.match(page, /id="more-episodes-heading"/);
    assert.match(page, />\s*More episodes\s*</);
    assert.match(
      page,
      /<EpisodeShelf key=\{episode\.slug\} episodes=\{others\} instanceId="more-episodes" \/>/,
    );
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PODCAST_LISTEN, topicTiles, topicTileTarget } from "./topic-tiles.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("topic tiles", () => {
  it("sends Comics to the collection and the other beats to the episode list", () => {
    assert.deepEqual(
      topicTiles.map((tile) => [tile.label, tile.href, tile.accessibleName]),
      [
        ["Comics", "/comic/collection", "Comics: see John's collection"],
        ["Movies", "/podcast#episodes", "Movies: see episodes"],
        ["Tech", "/podcast#episodes", "Tech: see episodes"],
        ["Politics", "/podcast#episodes", "Politics: see episodes"],
        ["Markets", "/podcast#episodes", "Markets: see episodes"],
      ],
    );
    assert.deepEqual(topicTileTarget(topicTiles[0]), { to: "/comic/collection" });
    for (const tile of topicTiles.slice(1)) {
      assert.deepEqual(topicTileTarget(tile), { to: "/podcast", hash: "episodes" });
    }
  });

  it("renders those same hrefs on the home page and the podcast page", () => {
    const home = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
    const podcast = readFileSync(join(root, "src/routes/podcast.index.tsx"), "utf8");
    assert.match(home, /<TopicTiles\s*\/>/);
    assert.match(podcast, /<TopicTiles\s*\/>/);
    assert.match(home, /from "@\/components\/topic-tiles"/);
    assert.match(podcast, /from "@\/components\/topic-tiles"/);
    assert.doesNotMatch(home, /homeBeatHref|ep-comics\.webp/);
    assert.doesNotMatch(podcast, /podcastBeatHref|ep-comics\.webp/);
  });

  it("links the podcast splash to the latest episode without a second tab stop", () => {
    assert.equal(PODCAST_LISTEN, "/listen");
    const podcast = readFileSync(join(root, "src/routes/podcast.index.tsx"), "utf8");
    assert.match(podcast, /to=\{PODCAST_LISTEN\}/);
    assert.match(podcast, /tabIndex=\{-1\}/);
    assert.match(podcast, /aria-hidden="true"/);
    assert.match(podcast, /id="episodes" className="mt-14 scroll-mt-20"/);
    assert.match(podcast, /id="live" className="[^"]*scroll-mt-20/);
  });
});

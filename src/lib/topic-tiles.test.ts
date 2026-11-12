import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PODCAST_LISTEN, PODCAST_LIVE, topicTiles, topicTileTarget } from "./topic-tiles.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("topic tiles", () => {
  it("sends Comics to the collection and the other beats to the episode list", () => {
    assert.deepEqual(
      topicTiles.map((tile) => [tile.label, tile.href, tile.accessibleName]),
      [
        ["Comics", "/comic/collection", "Comics: see John's collection"],
        ["Movies", "/movies", "Movies: see movies & TV we've discussed"],
        ["Tech", "/podcast#episodes", "Tech: see episodes"],
        ["Politics", "/podcast#episodes", "Politics: see episodes"],
        ["Markets", "/podcast#episodes", "Markets: see episodes"],
      ],
    );
    assert.deepEqual(topicTileTarget(topicTiles[0]), { to: "/comic/collection" });
    assert.deepEqual(topicTileTarget(topicTiles[1]), { to: "/movies" });
    for (const tile of topicTiles.slice(2)) {
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

  it("points the home hero and the header at the live section", () => {
    assert.deepEqual(PODCAST_LIVE, { to: "/podcast", hash: "live" });
    const home = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
    const header = readFileSync(join(root, "src/components/site-header.tsx"), "utf8");
    assert.match(home, /<Link to=\{PODCAST_LIVE\.to\} hash=\{PODCAST_LIVE\.hash\}>/);
    assert.match(header, /to: PODCAST_LIVE\.to, hash: PODCAST_LIVE\.hash, label: "The Podcast"/);
    assert.match(
      header,
      /to === PODCAST_LIVE\.to && pathname\.startsWith\(`\$\{PODCAST_LIVE\.to\}\/`\)/,
    );
    assert.match(header, /hash=\{"hash" in l \? l\.hash : undefined\}/);
    assert.match(header, /onClick=\{\(\) => setOpen\(false\)\}/);
    assert.doesNotMatch(header, /\/listen/);
  });
});

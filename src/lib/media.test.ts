import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mediaByKind,
  mediaCatalog,
  mediaCounts,
  mediaTabLabel,
  renderMediaGrid,
  renderMediaTabs,
} from "./media.ts";

describe("movies and tv", () => {
  it("counts the tabs from the catalog", () => {
    const counts = mediaCounts();
    assert.equal(counts.movies, 26);
    assert.equal(counts.tv, 17);
    assert.equal(mediaCatalog.length, 43);
    assert.equal(mediaTabLabel("movies"), "Movies (26)");
    assert.equal(mediaTabLabel("tv"), "TV (17)");
    const tabs = renderMediaTabs();
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /role="tab"/);
    assert.match(tabs, /Movies \(26\)/);
    assert.match(tabs, /TV \(17\)/);
    assert.match(tabs, /aria-selected="true"/);
  });

  it("gives every title a Wikipedia link and keeps logos uncropped", () => {
    const html = renderMediaGrid(mediaByKind("movie")) + renderMediaGrid(mediaByKind("tv"));
    for (const entry of mediaCatalog) {
      assert.match(html, new RegExp(`href="${entry.wikipedia_url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
      assert.match(html, /target="_blank"/);
      assert.match(html, /rel="noopener noreferrer"/);
      assert.match(html, new RegExp(`data-media-id="${entry.id}"`));
    }
    assert.match(html, /media-shot-logo/);
    assert.match(html, /media-title-card/);
    assert.equal(html.split('target="_blank"').length - 1, mediaCatalog.length);
  });

  it("puts the newest episode mention first", () => {
    const movies = mediaByKind("movie");
    const first = movies[0];
    assert.ok(first);
    assert.equal(
      first.episodes.some(
        (episode) => episode.slug === "einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die",
      ),
      true,
    );
  });
});

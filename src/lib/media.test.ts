import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEDIA_HOST_EMAILS,
  MEDIA_RATING_LABEL,
  mediaAdminDecision,
  mediaByKind,
  mediaCatalog,
  mediaCounts,
  mediaRatingDecision,
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

  it("shows both host ratings with accessible labels", () => {
    const entry = {
      ...mediaCatalog[0]!,
      ratings: { john: "two_up" as const, dan: "one_down" as const },
    };
    const html = renderMediaGrid([entry]);
    assert.match(html, /aria-label="Two thumbs up"/);
    assert.match(html, /aria-label="One thumb down"/);
    assert.match(html, /John:/);
    assert.match(html, /Dan:/);
    assert.equal(MEDIA_RATING_LABEL.not_seen, "Haven't seen it");
    const unseen = renderMediaGrid([mediaCatalog[1]!]);
    assert.match(unseen, /aria-label="Haven&#39;t seen it"/);
  });

  it("lets only John set John's rating and only Dan set Dan's", () => {
    const john = { signedIn: true, role: "admin", email: MEDIA_HOST_EMAILS.john };
    const dan = { signedIn: true, role: "admin", email: MEDIA_HOST_EMAILS.dan };
    const other = { signedIn: true, role: "admin", email: "spacebatshow@gmail.com" };
    const listener = { signedIn: true, role: "listener", email: MEDIA_HOST_EMAILS.john };
    const signedOut = { signedIn: false, role: "admin", email: MEDIA_HOST_EMAILS.john };

    assert.deepEqual(mediaRatingDecision({ ...john, host: "john" }), { ok: true });
    assert.deepEqual(mediaRatingDecision({ ...dan, host: "dan" }), { ok: true });
    assert.deepEqual(mediaRatingDecision({ ...john, host: "dan" }), {
      ok: false,
      status: 403,
      error: "You can only set your own rating.",
    });
    assert.deepEqual(mediaRatingDecision({ ...dan, host: "john" }), {
      ok: false,
      status: 403,
      error: "You can only set your own rating.",
    });
    assert.equal(mediaRatingDecision({ ...john, email: "Jack2Ryan@aim.com", host: "john" }).ok, true);
    assert.deepEqual(mediaRatingDecision({ ...other, host: "john" }), {
      ok: false,
      status: 403,
      error: "You can only set your own rating.",
    });
    assert.deepEqual(mediaRatingDecision({ ...other, host: "dan" }), {
      ok: false,
      status: 403,
      error: "You can only set your own rating.",
    });
    assert.deepEqual(mediaRatingDecision({ ...listener, host: "john" }), {
      ok: false,
      status: 403,
      error: "Crew only.",
    });
    assert.deepEqual(mediaRatingDecision({ ...signedOut, host: "john" }), {
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("allows create, edit, and delete only for an admin", () => {
    const refused = [
      mediaAdminDecision({ signedIn: false, role: "admin" }),
      mediaAdminDecision({ signedIn: true, role: "listener" }),
      mediaAdminDecision({ signedIn: true, role: null }),
    ];
    assert.deepEqual(refused, [
      { ok: false, status: 401, error: "Unauthorized" },
      { ok: false, status: 403, error: "Crew only." },
      { ok: false, status: 403, error: "Crew only." },
    ]);
    assert.deepEqual(mediaAdminDecision({ signedIn: true, role: "admin" }), { ok: true });
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

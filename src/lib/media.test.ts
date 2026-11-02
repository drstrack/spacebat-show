import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEDIA_HOST_EMAILS,
  MEDIA_RATING_CYCLE,
  MEDIA_RATING_LABEL,
  mediaAdminDecision,
  mediaByKind,
  mediaCatalog,
  mediaCounts,
  mediaRatingDecision,
  mediaTabLabel,
  applyStableOrder,
  holdVisibleIds,
  idsForRatingView,
  nextHostRating,
  orderForRater,
  ratingWrite,
  renderMediaGrid,
  renderMediaTabs,
  unratedCount,
  type MediaEntry,
  type MediaRatingChoice,
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
    assert.equal(MEDIA_RATING_LABEL.unrated, "Not rated yet");
    const unseen = renderMediaGrid([mediaCatalog[1]!]);
    assert.match(unseen, /aria-label="Not rated yet"/);
    assert.equal(unseen.includes("Haven't seen it"), false);
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

  it("links the frame to TMDB and keeps Wikipedia and IMDb beside it", () => {
    const entry = {
      ...mediaCatalog[0]!,
      tmdbId: 11,
      tmdbType: "movie" as const,
      imdbId: "tt0076759",
      posterPath: "/star.jpg",
      overview: "A long time ago.",
    };
    const html = renderMediaGrid([entry]);
    assert.match(html, /href="https:\/\/www\.themoviedb\.org\/movie\/11"/);
    assert.match(html, /href="https:\/\/en\.wikipedia\.org\/wiki\/Avengers%3A_Doomsday"/);
    assert.match(html, />Wikipedia</);
    assert.match(html, /href="https:\/\/www\.imdb\.com\/title\/tt0076759\/"/);
    assert.match(html, /src="https:\/\/image\.tmdb\.org\/t\/p\/w342\/star\.jpg"/);
    assert.match(html, /srcset="https:\/\/image\.tmdb\.org\/t\/p\/w185\/star\.jpg 185w/);
    assert.match(html, /A long time ago\./);
  });

  it("cycles ratings and wraps from haven't seen it back through unrated", () => {
    const steps: MediaRatingChoice[] = ["unrated"];
    for (let i = 0; i < MEDIA_RATING_CYCLE.length; i += 1) {
      steps.push(nextHostRating(steps[steps.length - 1]!));
    }
    assert.deepEqual(steps, ["unrated", ...MEDIA_RATING_CYCLE.slice(0, -1), "unrated"]);
    assert.equal(nextHostRating("not_seen"), "unrated");
    assert.equal(nextHostRating("unrated"), "two_up");
    assert.deepEqual(ratingWrite("unrated"), { action: "delete" });
    assert.deepEqual(ratingWrite("not_seen"), { action: "upsert", rating: "not_seen" });
    assert.deepEqual(ratingWrite("two_up"), { action: "upsert", rating: "two_up" });
  });

  it("puts unrated titles first for that host only", () => {
    const sample = (id: string, title: string, john: MediaRatingChoice, dan: MediaRatingChoice): MediaEntry => ({
      ...mediaCatalog[0]!,
      id,
      title,
      ratings: { john, dan },
    });
    const entries = [
      sample("a", "Alpha", "two_up", "unrated"),
      sample("z", "Zed", "unrated", "ok"),
      sample("m", "Middle", "unrated", "unrated"),
    ];
    assert.deepEqual(
      orderForRater(entries, "john").map((entry) => entry.title),
      ["Middle", "Zed", "Alpha"],
    );
    assert.equal(unratedCount(entries, "john"), 2);
    assert.deepEqual(
      orderForRater(entries, "dan").map((entry) => entry.title),
      ["Alpha", "Middle", "Zed"],
    );
    assert.deepEqual(
      orderForRater(entries, null).map((entry) => entry.title),
      ["Alpha", "Middle", "Zed"],
    );
  });

  it("does not move a card when its rating changes until the order is refreshed", () => {
    const sample = (id: string, title: string, dan: MediaRatingChoice): MediaEntry => ({
      ...mediaCatalog[0]!,
      id,
      title,
      ratings: { john: "unrated", dan },
    });
    const start = [
      sample("z", "Zed", "unrated"),
      sample("a", "Alpha", "unrated"),
      sample("m", "Middle", "two_up"),
    ];
    const pinned = orderForRater(start, "dan").map((entry) => entry.id);
    assert.deepEqual(pinned, ["a", "z", "m"]);
    const tapped = start.map((entry) =>
      entry.id === "a" ? { ...entry, ratings: { ...entry.ratings, dan: "two_up" as const } } : entry,
    );
    assert.deepEqual(
      applyStableOrder(pinned, tapped).map((entry) => entry.id),
      ["a", "z", "m"],
    );
    assert.deepEqual(
      orderForRater(tapped, "dan").map((entry) => entry.id),
      ["z", "a", "m"],
    );
  });

  it("keeps a saved title in the not-rated view until that view is rebuilt", () => {
    const sample = (id: string, title: string, dan: MediaRatingChoice): MediaEntry => ({
      ...mediaCatalog[0]!,
      id,
      title,
      ratings: { john: "unrated", dan },
    });
    const entries = [sample("a", "Alpha", "unrated"), sample("b", "Beta", "ok"), sample("c", "Coral", "unrated")];
    const visible = idsForRatingView(entries, "dan", "unrated");
    assert.deepEqual(visible, ["a", "c"]);
    const saved = entries.map((entry) =>
      entry.id === "a" ? { ...entry, ratings: { ...entry.ratings, dan: "two_up" as const } } : entry,
    );
    assert.deepEqual(
      holdVisibleIds(visible, saved).map((entry) => entry.id),
      ["a", "c"],
    );
    assert.deepEqual(idsForRatingView(saved, "dan", "unrated"), ["c"]);
    assert.deepEqual(idsForRatingView(saved, "dan", "rated"), ["a", "b"]);
    assert.equal(idsForRatingView(saved, "dan", "all").length, 3);
  });

  it("keeps a cycled rating pending until it is written", () => {
    let shown: MediaRatingChoice = "unrated";
    shown = nextHostRating(shown);
    shown = nextHostRating(shown);
    shown = nextHostRating(shown);
    assert.equal(shown, "ok");
    assert.notEqual(shown, "unrated");
    assert.deepEqual(ratingWrite(shown), { action: "upsert", rating: "ok" });
    assert.deepEqual(ratingWrite("unrated"), { action: "delete" });
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

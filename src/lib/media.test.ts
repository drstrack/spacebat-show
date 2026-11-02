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
  mediaPrimaryUrl,
  mediaRatingDecision,
  mediaSecondaryLinks,
  mediaTabLabel,
  applyStableOrder,
  holdVisibleIds,
  idsForRatingView,
  nextHostRating,
  orderForRater,
  ratingViewCount,
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
    assert.equal(counts.movies, 50);
    assert.equal(counts.tv, 29);
    assert.equal(mediaCatalog.length, 79);
    assert.equal(mediaTabLabel("movies"), "Movies (50)");
    assert.equal(mediaTabLabel("tv"), "TV (29)");
    const tabs = renderMediaTabs();
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /role="tab"/);
    assert.match(tabs, /Movies \(50\)/);
    assert.match(tabs, /TV \(29\)/);
    assert.match(tabs, /aria-selected="true"/);
  });

  it("gives every title a Wikipedia link and keeps logos uncropped", () => {
    const html = renderMediaGrid(mediaByKind("movie")) + renderMediaGrid(mediaByKind("tv"));
    for (const entry of mediaCatalog) {
      if (entry.wikipedia_url) {
        assert.match(html, new RegExp(`href="${entry.wikipedia_url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
      }
      assert.match(html, /target="_blank"/);
      assert.match(html, /rel="noopener noreferrer"/);
      assert.match(html, new RegExp(`data-media-id="${entry.id}"`));
    }
    assert.match(html, /media-shot-logo/);
    assert.match(html, /media-title-card/);
    const externalLinks = mediaCatalog.reduce(
      (sum, entry) => sum + (mediaPrimaryUrl(entry) ? 1 : 0) + mediaSecondaryLinks(entry).length,
      0,
    );
    assert.equal(html.split('target="_blank"').length - 1, externalLinks);
  });

  it("includes 2001: A Space Odyssey with the TMDB poster", () => {
    const entry = mediaCatalog.find((item) => item.id === "2001-a-space-odyssey");
    assert.ok(entry);
    assert.equal(entry.kind, "movie");
    assert.equal(entry.title, "2001: A Space Odyssey");
    assert.equal(entry.year, "1968");
    assert.equal(entry.tmdbId, 62);
    assert.equal(entry.tmdbType, "movie");
    assert.equal(entry.imdbId, "tt0062622");
    assert.equal(entry.posterPath, "/ve72VxNqjGM69Uky4WTo2bK6rfq.jpg");
    assert.match(entry.overview ?? "", /HAL 9000/);
    assert.equal(entry.ratings.dan, "unrated");
    assert.equal(entry.ratings.john, "unrated");
    const html = renderMediaGrid([entry]);
    assert.match(html, /src="https:\/\/image\.tmdb\.org\/t\/p\/w342\/ve72VxNqjGM69Uky4WTo2bK6rfq\.jpg"/);
    assert.match(html, /href="https:\/\/www\.themoviedb\.org\/movie\/62"/);
    assert.match(html, /aria-label="Not rated yet"/);
  });

  it("keeps the rescan titles, their posters, and the episode they were mentioned on", () => {
    const blade = mediaCatalog.find((item) => item.id === "blade-runner");
    const later = mediaCatalog.find((item) => item.id === "blade-runner-2049");
    const original = mediaCatalog.find((item) => item.id === "battlestar-galactica-1978");
    const reboot = mediaCatalog.find((item) => item.id === "battlestar-galactica-2004");
    const birds = mediaCatalog.find((item) => item.id === "the-birds");
    const below = mediaCatalog.find((item) => item.id === "below");
    assert.ok(blade && later && original && reboot && birds && below);
    assert.equal(blade.tmdbId, 78);
    assert.equal(blade.posterPath, "/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg");
    assert.equal(blade.episodes[0]?.slug, "einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die");
    assert.equal(blade.episodes[0]?.timestamp, "01:53:27");
    assert.equal(later.tmdbId, 335984);
    assert.notEqual(original.tmdbId, reboot.tmdbId);
    assert.equal(original.tmdbType, "tv");
    assert.equal(birds.tmdbId, 340379);
    assert.equal(birds.posterPath, null);
    assert.equal(birds.wikipedia_url, "");
    assert.equal(below.best_guess, true);
    assert.match(below.best_guess_reason ?? "", /Newfoundland/);
    const html = renderMediaGrid([blade, below]);
    assert.match(html, /image\.tmdb\.org\/t\/p\/w342\/63N9uy8nd9j7Eog2axPQ8lbr3Wj\.jpg/);
    assert.match(html, /image\.tmdb\.org\/t\/p\/w342\/vgLqqhMUbljp585qPp1EFCyJtcz\.jpg/);
    assert.match(html, /href="\/podcast\/einstein-vs-ai-road-rage-amazon-where-superheroes-go-to-die"/);
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

  it("keeps haven't seen it out of the rated bucket", () => {
    const sample = (id: string, dan: MediaRatingChoice): MediaEntry => ({
      ...mediaCatalog[0]!,
      id,
      title: id,
      kind: id === "show" ? "tv" : "movie",
      ratings: { john: "unrated", dan },
    });
    const entries = [
      sample("fresh", "unrated"),
      sample("loved", "two_up"),
      sample("fine", "ok"),
      sample("skip", "not_seen"),
      sample("show", "not_seen"),
    ];
    assert.deepEqual(idsForRatingView(entries, "dan", "unrated"), ["fresh"]);
    assert.deepEqual(idsForRatingView(entries, "dan", "rated"), ["loved", "fine"]);
    assert.deepEqual(idsForRatingView(entries, "dan", "not_seen"), ["skip", "show"]);
    assert.equal(idsForRatingView(entries, "dan", "all").length, 5);
    assert.equal(ratingViewCount(entries, "dan", "unrated"), 1);
    assert.equal(ratingViewCount(entries, "dan", "rated"), 2);
    assert.equal(ratingViewCount(entries, "dan", "not_seen"), 2);
    assert.equal(ratingViewCount(entries, "dan", "all"), 5);
    assert.equal(
      ratingViewCount(entries, "dan", "unrated") +
        ratingViewCount(entries, "dan", "rated") +
        ratingViewCount(entries, "dan", "not_seen"),
      entries.length,
    );
    const visible = idsForRatingView(entries, "dan", "unrated");
    const saved = entries.map((entry) =>
      entry.id === "fresh" ? { ...entry, ratings: { ...entry.ratings, dan: "not_seen" as const } } : entry,
    );
    assert.deepEqual(
      holdVisibleIds(visible, saved).map((entry) => entry.id),
      ["fresh"],
    );
    assert.deepEqual(idsForRatingView(saved, "dan", "not_seen"), ["fresh", "skip", "show"]);
    assert.deepEqual(idsForRatingView(saved, "dan", "rated"), ["loved", "fine"]);
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lookupTmdb, proposeTmdbMatches, searchTmdb, type TmdbFetch } from "./tmdb.server.ts";
import {
  chooseTmdbMatch,
  classifyTmdbKey,
  mapTmdbDetails,
  mapTmdbSearchResult,
  TMDB_KEY_MISSING,
  tmdbPoster,
} from "./tmdb.ts";

const SECRET = "0123456789abcdef0123456789abcdef";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";

const movie = {
  id: 11,
  title: "Star Wars",
  release_date: "1977-05-25",
  overview: "A long time ago.",
  poster_path: "/star.jpg",
};

const show = {
  id: 1399,
  name: "Game of Thrones",
  first_air_date: "2011-04-17",
  overview: "Winter is coming.",
  poster_path: "/thrones.jpg",
};

test("maps a movie search result and a TV search result", () => {
  const film = mapTmdbSearchResult("movie", movie);
  assert.equal(film?.title, "Star Wars");
  assert.equal(film?.year, "1977");
  assert.equal(film?.tmdbType, "movie");
  assert.equal(film?.posterPath, "/star.jpg");
  assert.equal(film?.imdbId, null);

  const series = mapTmdbSearchResult("tv", show);
  assert.equal(series?.title, "Game of Thrones");
  assert.equal(series?.year, "2011");
  assert.equal(series?.tmdbType, "tv");
  assert.equal(mapTmdbSearchResult("tv", { id: 1, title: "Wrong field" }), null);
});

test("reads imdb_id from external_ids on movie and TV details", () => {
  const film = mapTmdbDetails("movie", {
    ...movie,
    external_ids: { imdb_id: "tt0076759" },
  });
  assert.equal(film?.imdbId, "tt0076759");
  const series = mapTmdbDetails("tv", {
    ...show,
    external_ids: { imdb_id: "tt0944947" },
  });
  assert.equal(series?.imdbId, "tt0944947");
  assert.equal(mapTmdbDetails("movie", { ...movie, external_ids: { imdb_id: "not-an-id" } })?.imdbId, null);
});

test("builds a w342 poster and srcset without calling the network", () => {
  const poster = tmdbPoster("/star.jpg");
  assert.equal(poster?.src, "https://image.tmdb.org/t/p/w342/star.jpg");
  assert.match(poster?.srcset ?? "", /w185\/star\.jpg 185w/);
  assert.match(poster?.srcset ?? "", /w500\/star\.jpg 500w/);
  assert.equal(tmdbPoster("https://evil.example/star.jpg"), null);
});

test("a missing key does not call fetch", async () => {
  let called = false;
  const fetchImpl: TmdbFetch = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const found = await searchTmdb(
    { title: "Star Wars", year: "1977", kind: "movie" },
    { env: {}, fetch: fetchImpl },
  );
  assert.equal(found.configured, false);
  assert.equal(found.error, TMDB_KEY_MISSING);
  assert.equal(called, false);
  const looked = await lookupTmdb(
    { tmdbId: 11, tmdbType: "movie" },
    { env: { TMDB_API_KEY: "   " }, fetch: fetchImpl },
  );
  assert.equal(looked.configured, false);
  assert.equal(called, false);
});

test("a v3 key is a query param and a v4 token is a bearer, and neither comes back", async () => {
  assert.equal(classifyTmdbKey(undefined), null);
  assert.equal(classifyTmdbKey(SECRET)?.mode, "v3");
  assert.equal(classifyTmdbKey("0123456789ABCDEF0123456789ABCDEF")?.mode, "v3");
  assert.equal(classifyTmdbKey(TOKEN)?.mode, "v4");
  assert.equal(classifyTmdbKey("not-a-short-hex-key")?.mode, "v4");
  assert.equal(classifyTmdbKey("0123456789abcdef")?.mode, "v4");

  const seen: { url: string; authorization: string }[] = [];
  const fetchImpl: TmdbFetch = async (url, init) => {
    seen.push({ url, authorization: init?.headers?.authorization ?? "" });
    if (url.includes("/search/")) {
      return { ok: true, status: 200, json: async () => ({ results: [movie] }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ...movie, external_ids: { imdb_id: "tt0076759" } }),
    };
  };

  const v3 = await searchTmdb(
    { title: "Star Wars", year: "1977", kind: "movie" },
    { env: { TMDB_API_KEY: SECRET }, fetch: fetchImpl },
  );
  assert.equal(v3.configured, true);
  assert.equal(v3.results[0]?.title, "Star Wars");
  assert.match(seen[0]?.url ?? "", /api_key=0123456789abcdef0123456789abcdef/);
  assert.equal(seen[0]?.authorization, "");
  assert.equal(JSON.stringify(v3).includes(SECRET), false);

  const v4 = await lookupTmdb(
    { tmdbId: 11, tmdbType: "movie" },
    { env: { TMDB_API_KEY: TOKEN }, fetch: fetchImpl },
  );
  assert.equal(v4.results?.imdbId, "tt0076759");
  assert.equal(seen[1]?.url.includes("api_key="), false);
  assert.equal(seen[1]?.authorization, `Bearer ${TOKEN}`);
  assert.equal(JSON.stringify(v4).includes(TOKEN), false);
  assert.equal(JSON.stringify(v4).includes(SECRET), false);
});

test("the key is not referenced by client pages", () => {
  const clientFiles = [
    "src/routes/movies.tsx",
    "src/routes/admin.movies.tsx",
    "src/lib/media.ts",
    "src/lib/tmdb.ts",
  ];
  for (const file of clientFiles) {
    assert.equal(readFileSync(file, "utf8").includes("TMDB_API_KEY"), false, file);
  }
  assert.match(readFileSync("src/lib/tmdb.server.ts", "utf8"), /TMDB_API_KEY/);
});

test("a bulk match proposes a hit and keeps the best-guess flag", async () => {
  const fetchImpl: TmdbFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ results: [movie] }),
  });
  const proposed = await proposeTmdbMatches(
    [{ id: "star-wars", title: "Star Wars", year: "1977", kind: "movie", bestGuess: true }],
    { env: { TMDB_API_KEY: SECRET }, fetch: fetchImpl },
  );
  assert.equal(proposed.configured, true);
  assert.equal(proposed.results[0]?.bestGuess, true);
  assert.equal(proposed.results[0]?.proposal?.tmdbId, 11);
  assert.equal(JSON.stringify(proposed).includes(SECRET), false);
});

test("chooses a same-year title match and keeps a weak hit for review", () => {
  const hits = [
    mapTmdbSearchResult("movie", { ...movie, id: 1, title: "Spaceballs", release_date: "1987-06-24" })!,
    mapTmdbSearchResult("movie", movie)!,
  ];
  assert.equal(chooseTmdbMatch({ title: "Star Wars", year: "1977" }, hits)?.tmdbId, 11);
  assert.equal(chooseTmdbMatch({ title: "Something else", year: "" }, hits)?.tmdbId, 1);
});

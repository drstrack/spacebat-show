import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import {
  addColumnTarget,
  applyPendingSqliteMigrations,
  bootstrapSqliteSchema,
  sqlStatements,
  toSqlite,
} from "./sqlite-migrate.ts";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
}

function memory(): Client {
  return createClient({ url: ":memory:" });
}

async function columnNames(client: Client, table: string): Promise<string[]> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.map((row) => String(row.name)).sort();
}

async function appliedNames(client: Client): Promise<string[]> {
  const result = await client.execute("select name from _migrations order by name");
  return result.rows.map((row) => String(row.name));
}

describe("sqlite migrations", () => {
  it("does not use ADD COLUMN IF NOT EXISTS", () => {
    const sql = readFileSync(join(migrationsDir, "0010_memorabilia_original.sql"), "utf8");
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.doesNotMatch(statements, /if\s+not\s+exists/i);
    assert.match(sql, /add column original_url text/i);
    assert.match(sql, /add column original_pathname text/i);
    assert.deepEqual(addColumnTarget("alter table memorabilia_frame add column original_url text"), {
      table: "memorabilia_frame",
      column: "original_url",
    });
  });

  it("applies every migration on a fresh libsql database", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      await bootstrapSqliteSchema(client, files);
      const applied = await appliedNames(client);
      assert.deepEqual(
        applied,
        files.map((file) => file.name),
      );
      const columns = await columnNames(client, "memorabilia_frame");
      assert.ok(columns.includes("original_url"));
      assert.ok(columns.includes("original_pathname"));
      assert.ok(columns.includes("url"));
      const tables = await client.execute(
        "select name from sqlite_master where type = 'table' order by name",
      );
      const names = tables.rows.map((row) => String(row.name));
      for (const table of [
        "user",
        "session",
        "account",
        "verification",
        "member_profile",
        "chat_message",
        "chat_upload",
        "memorabilia_frame",
        "media_rating",
        "tech_product",
        "_migrations",
      ]) {
        assert.ok(names.includes(table), table);
      }
    } finally {
      client.close();
    }
  });

  it("applies 0010 onto 0001–0009 and can run 0010 twice", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const prior = files.filter((file) => file.name < "0010_memorabilia_original.sql");
      const current = files.find((file) => file.name === "0010_memorabilia_original.sql");
      assert.ok(current);
      assert.ok(prior.length >= 9);
      await bootstrapSqliteSchema(client, prior);
      assert.equal((await columnNames(client, "memorabilia_frame")).includes("original_url"), false);

      await bootstrapSqliteSchema(client, files);
      assert.deepEqual(
        (await columnNames(client, "memorabilia_frame")).filter((name) => name.startsWith("original_")),
        ["original_pathname", "original_url"],
      );

      await bootstrapSqliteSchema(client, files);
      assert.equal(
        (await appliedNames(client)).filter((name) => name === current.name).length,
        1,
      );

      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: [current.name],
      });
      await bootstrapSqliteSchema(client, files);
      const columns = await columnNames(client, "memorabilia_frame");
      assert.equal(columns.filter((name) => name === "original_url").length, 1);
      assert.equal(columns.filter((name) => name === "original_pathname").length, 1);
      assert.ok((await appliedNames(client)).includes(current.name));
    } finally {
      client.close();
    }
  });

  it("skips a column added before a failed 0010 and does not record the failure", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const prior = files.filter((file) => file.name < "0010_memorabilia_original.sql");
      await bootstrapSqliteSchema(client, prior);
      await client.execute("alter table memorabilia_frame add column original_url text");
      const broken = {
        name: "0010_memorabilia_original.sql",
        sql: `
          alter table memorabilia_frame add column original_url text;
          alter table memorabilia_frame add column not valid sql;
        `,
      };
      await assert.rejects(() => applyPendingSqliteMigrations(client, [broken], []));
      assert.equal((await appliedNames(client)).includes(broken.name), false);
      assert.ok((await columnNames(client, "memorabilia_frame")).includes("original_url"));
      assert.equal(
        (await columnNames(client, "memorabilia_frame")).includes("original_pathname"),
        false,
      );

      await bootstrapSqliteSchema(client, files);
      const columns = await columnNames(client, "memorabilia_frame");
      assert.ok(columns.includes("original_url"));
      assert.ok(columns.includes("original_pathname"));
      assert.ok((await appliedNames(client)).includes("0010_memorabilia_original.sql"));
    } finally {
      client.close();
    }
  });

  it("inserts frame 1 once and does not recreate it after it is deleted", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      await bootstrapSqliteSchema(client, files);
      const frames = await client.execute(
        "select url, pathname, caption, alt_text, sort_order, width, height from memorabilia_frame order by sort_order, id",
      );
      assert.equal(frames.rows.length, 1);
      const frame = frames.rows[0];
      assert.equal(frame?.url, "/memorabilia/frame-01-batman-statue-v2.jpg");
      assert.equal(frame?.pathname, "static/frame-01-batman-statue-v2.jpg");
      assert.equal(frame?.caption, "Batman, on the Batcave base.");
      assert.equal(
        frame?.alt_text,
        "A large blue-and-grey Batman statue on a Batcave-style base, with several small Batman busts around it, on a wooden coffee table.",
      );
      assert.equal(Number(frame?.sort_order), 0);
      assert.equal(Number(frame?.width), 921);
      assert.equal(Number(frame?.height), 1038);
      const marker = await client.execute("select id, note from memorabilia_seed");
      assert.equal(marker.rows.length, 1);
      assert.equal(Number(marker.rows[0]?.id), 1);

      await client.execute("delete from memorabilia_frame");
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: ["0011_memorabilia_frame_one.sql"],
      });
      await bootstrapSqliteSchema(client, files);
      const again = await client.execute("select count(*) as n from memorabilia_frame");
      assert.equal(Number(again.rows[0]?.n), 0);
      const markerAgain = await client.execute("select count(*) as n from memorabilia_seed");
      assert.equal(Number(markerAgain.rows[0]?.n), 1);
      assert.ok((await appliedNames(client)).includes("0011_memorabilia_frame_one.sql"));
    } finally {
      client.close();
    }
  });

  it("seeds the catalog once and does not recreate a deleted title", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const media = files.find((file) => file.name === "0012_media.sql");
      assert.ok(media);
      assert.doesNotMatch(media.sql, /\b(user|session|account)\b/i);
      assert.doesNotMatch(media.sql, /drop\s+table/i);
      await bootstrapSqliteSchema(client, files);
      const count = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(count.rows[0]?.n), 98);
      const kinds = await client.execute(
        "select kind, count(*) as n from media_item group by kind order by kind",
      );
      assert.equal(Number(kinds.rows.find((row) => row.kind === "movie")?.n), 64);
      assert.equal(Number(kinds.rows.find((row) => row.kind === "tv")?.n), 34);
      const marker = await client.execute("select id, note from media_seed order by id");
      assert.equal(marker.rows.length, 4);
      assert.equal(marker.rows[0]?.note, "catalog-43");
      assert.equal(marker.rows[1]?.note, "2001-a-space-odyssey");
      assert.equal(marker.rows[2]?.note, "rescan-2026-11-01");
      assert.equal(marker.rows[3]?.note, "episodes-6-7");
      for (const table of ["user", "session", "account"]) {
        const info = await client.execute(`PRAGMA table_info(${table})`);
        assert.ok(info.rows.length > 0, table);
      }

      await client.execute("delete from media_item where id = 'alien'");
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: ["0012_media.sql"],
      });
      await bootstrapSqliteSchema(client, files);
      const again = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(again.rows[0]?.n), 97);
      const alien = await client.execute("select count(*) as n from media_item where id = 'alien'");
      assert.equal(Number(alien.rows[0]?.n), 0);
      const markerAgain = await client.execute("select count(*) as n from media_seed");
      assert.equal(Number(markerAgain.rows[0]?.n), 4);

      await bootstrapSqliteSchema(client, files);
      const third = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(third.rows[0]?.n), 97);
    } finally {
      client.close();
    }
  });

  it("seeds 43 titles on the preview database and does not insert them twice", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite();
    try {
      await pg.waitReady;
      const media = migrationFiles().find((file) => file.name === "0012_media.sql");
      assert.ok(media);
      await pg.exec(media.sql);
      const count = await pg.query<{ n: number }>("select count(*)::int as n from media_item");
      assert.equal(count.rows[0]?.n, 43);
      await pg.exec(media.sql);
      const again = await pg.query<{ n: number }>("select count(*)::int as n from media_item");
      assert.equal(again.rows[0]?.n, 43);
      await pg.query(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'john', 'two_up', 1)",
      );
      await pg.exec("delete from media_item where id = 'alien'");
      const rating = await pg.query<{ n: number }>(
        "select count(*)::int as n from media_rating where media_item_id = 'alien'",
      );
      assert.equal(rating.rows[0]?.n, 0);
      await pg.exec(media.sql);
      const after = await pg.query<{ n: number }>("select count(*)::int as n from media_item");
      assert.equal(after.rows[0]?.n, 42);
    } finally {
      await pg.close();
    }
  });

  it("adds 2001: A Space Odyssey to an already seeded catalog without touching ratings", async () => {
    const client = memory();
    try {
      const files = migrationFiles().filter(
        (file) => file.name !== "0014_media_rescan.sql" && file.name !== "0016_media_ep6_ep7.sql",
      );
      const prior = files.filter((file) => file.name !== "0013_media_space_odyssey.sql");
      const added = files.find((file) => file.name === "0013_media_space_odyssey.sql");
      assert.ok(added);
      assert.doesNotMatch(added.sql, /drop\s+table/i);
      assert.doesNotMatch(added.sql, /\bupdate\s+media_item\b/i);
      assert.doesNotMatch(added.sql, /\bupdate\s+media_rating\b/i);
      await bootstrapSqliteSchema(client, prior);
      const before = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(before.rows[0]?.n), 43);
      await client.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'dan', 'ok', 5)",
      );
      const alienBefore = await client.execute("select title, year, overview from media_item where id = 'alien'");

      await bootstrapSqliteSchema(client, files);
      const count = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(count.rows[0]?.n), 44);
      const row = await client.execute(
        "select kind, title, year, tmdb_id, tmdb_type, imdb_id, poster_path, overview from media_item where id = '2001-a-space-odyssey'",
      );
      assert.equal(row.rows.length, 1);
      assert.equal(row.rows[0]?.kind, "movie");
      assert.equal(row.rows[0]?.title, "2001: A Space Odyssey");
      assert.equal(row.rows[0]?.year, "1968");
      assert.equal(Number(row.rows[0]?.tmdb_id), 62);
      assert.equal(row.rows[0]?.tmdb_type, "movie");
      assert.equal(row.rows[0]?.imdb_id, "tt0062622");
      assert.equal(row.rows[0]?.poster_path, "/ve72VxNqjGM69Uky4WTo2bK6rfq.jpg");
      assert.match(String(row.rows[0]?.overview), /HAL 9000/);
      const rating = await client.execute(
        "select rating from media_rating where media_item_id = 'alien' and host = 'dan'",
      );
      assert.equal(rating.rows[0]?.rating, "ok");
      const alienAfter = await client.execute("select title, year, overview from media_item where id = 'alien'");
      assert.deepEqual(alienAfter.rows, alienBefore.rows);

      await bootstrapSqliteSchema(client, files);
      const twice = await client.execute("select count(*) as n from media_item where tmdb_id = 62");
      assert.equal(Number(twice.rows[0]?.n), 1);

      await client.execute("delete from media_item where id = '2001-a-space-odyssey'");
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: ["0013_media_space_odyssey.sql"],
      });
      await bootstrapSqliteSchema(client, files);
      const gone = await client.execute(
        "select count(*) as n from media_item where id = '2001-a-space-odyssey'",
      );
      assert.equal(Number(gone.rows[0]?.n), 0);
      const still = await client.execute(
        "select rating from media_rating where media_item_id = 'alien' and host = 'dan'",
      );
      assert.equal(still.rows[0]?.rating, "ok");
    } finally {
      client.close();
    }
  });

  it("does not replace 2001 when that title is already stored", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite();
    try {
      await pg.waitReady;
      const files = migrationFiles();
      const base = files.find((file) => file.name === "0012_media.sql");
      const added = files.find((file) => file.name === "0013_media_space_odyssey.sql");
      assert.ok(base);
      assert.ok(added);
      await pg.exec(base.sql);
      await pg.exec(`
        insert into media_item (
          id, kind, title, year, wikipedia_url, tmdb_id, tmdb_type, overview, episodes, sort_rank, created_at, updated_at
        ) values (
          'custom-odyssey', 'movie', '2001: A Space Odyssey', '1968',
          'https://en.wikipedia.org/wiki/2001:_A_Space_Odyssey', 62, 'movie', 'keep me', '[]', 0, 1, 1
        )
      `);
      await pg.exec(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('custom-odyssey', 'dan', 'two_up', 9)",
      );
      await pg.exec(added.sql);
      const rows = await pg.query<{ id: string; overview: string }>(
        "select id, overview from media_item where tmdb_id = 62",
      );
      assert.equal(rows.rows.length, 1);
      assert.equal(rows.rows[0]?.id, "custom-odyssey");
      assert.equal(rows.rows[0]?.overview, "keep me");
      const rating = await pg.query<{ rating: string }>(
        "select rating from media_rating where media_item_id = 'custom-odyssey' and host = 'dan'",
      );
      assert.equal(rating.rows[0]?.rating, "two_up");
      await pg.exec(added.sql);
      const again = await pg.query<{ n: number }>("select count(*)::int as n from media_item where tmdb_id = 62");
      assert.equal(again.rows[0]?.n, 1);
      const others = await pg.query<{ n: number }>("select count(*)::int as n from media_item");
      assert.equal(others.rows[0]?.n, 44);
    } finally {
      await pg.close();
    }
  });

  it("adds the rescan titles once without changing an existing rating", async () => {
    const client = memory();
    try {
      const files = migrationFiles().filter((file) => file.name !== "0016_media_ep6_ep7.sql");
      const prior = files.filter((file) => file.name !== "0014_media_rescan.sql");
      const added = files.find((file) => file.name === "0014_media_rescan.sql");
      assert.ok(added);
      assert.doesNotMatch(added.sql, /drop\s+table/i);
      assert.doesNotMatch(added.sql, /\bupdate\s+media_(item|rating)\b/i);
      await bootstrapSqliteSchema(client, prior);
      const before = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(before.rows[0]?.n), 44);
      await client.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'dan', 'two_up', 8)",
      );
      await bootstrapSqliteSchema(client, files);
      const count = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(count.rows[0]?.n), 79);
      const blade = await client.execute(
        "select tmdb_id, tmdb_type, poster_path, episodes from media_item where id = 'blade-runner'",
      );
      assert.equal(Number(blade.rows[0]?.tmdb_id), 78);
      assert.equal(blade.rows[0]?.tmdb_type, "movie");
      assert.equal(blade.rows[0]?.poster_path, "/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg");
      assert.match(String(blade.rows[0]?.episodes), /01:53:27/);
      const shows = await client.execute(
        "select id from media_item where tmdb_id in (501, 1972) order by id",
      );
      assert.deepEqual(
        shows.rows.map((row) => row.id),
        ["battlestar-galactica-1978", "battlestar-galactica-2004"],
      );
      const birds = await client.execute("select poster_path from media_item where id = 'the-birds'");
      assert.equal(birds.rows[0]?.poster_path, null);
      const below = await client.execute("select best_guess from media_item where id = 'below'");
      assert.equal(Number(below.rows[0]?.best_guess), 1);
      const rating = await client.execute(
        "select rating from media_rating where media_item_id = 'alien' and host = 'dan'",
      );
      assert.equal(rating.rows[0]?.rating, "two_up");
      await bootstrapSqliteSchema(client, files);
      const twice = await client.execute("select count(*) as n from media_item where id = 'blade-runner'");
      assert.equal(Number(twice.rows[0]?.n), 1);
      await client.execute("delete from media_item where id = 'top-gun'");
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: ["0014_media_rescan.sql"],
      });
      await bootstrapSqliteSchema(client, files);
      const gone = await client.execute("select count(*) as n from media_item where id = 'top-gun'");
      assert.equal(Number(gone.rows[0]?.n), 0);
      const kept = await client.execute(
        "select rating from media_rating where media_item_id = 'alien' and host = 'dan'",
      );
      assert.equal(kept.rows[0]?.rating, "two_up");
    } finally {
      client.close();
    }
  });

  it("adds the episode 6 and 7 titles once, links existing titles, and does not add ratings", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const prior = files.filter((file) => file.name !== "0016_media_ep6_ep7.sql");
      const added = files.find((file) => file.name === "0016_media_ep6_ep7.sql");
      assert.ok(added);
      assert.doesNotMatch(added.sql, /drop\s+table/i);
      assert.doesNotMatch(added.sql, /insert\s+into\s+media_rating/i);
      assert.doesNotMatch(added.sql, /update\s+media_rating/i);
      assert.doesNotMatch(added.sql, /knightfall|black hawk|green mile|iron man 2|star trek|avengers/i);
      await bootstrapSqliteSchema(client, prior);
      const before = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(before.rows[0]?.n), 79);
      await client.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'dan', 'two_up', 8), ('loki', 'john', 'ok', 9)",
      );
      const ratingsBefore = await client.execute("select count(*) as n from media_rating");
      const lokiBefore = await client.execute(
        "select kind, title, year, wikipedia_url, tmdb_id, overview, poster_path, image, best_guess, sort_rank, created_at, updated_at from media_item where id = 'loki'",
      );
      const lokiEpisodesBefore = mentions(
        (await client.execute("select episodes from media_item where id = 'loki'")).rows[0]?.episodes,
      );
      const avengersBefore = await client.execute("select episodes from media_item where id = 'avengers-doomsday'");
      const odysseyBefore = await client.execute(
        "select title, year, tmdb_id, poster_path, overview from media_item where id = '2001-a-space-odyssey'",
      );

      await bootstrapSqliteSchema(client, files);
      const count = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(count.rows[0]?.n), 98);
      const ratingsAfter = await client.execute("select count(*) as n from media_rating");
      assert.equal(Number(ratingsAfter.rows[0]?.n), Number(ratingsBefore.rows[0]?.n));
      const newRatings = await client.execute(
        `select count(*) as n from media_rating where media_item_id in (
          'green-book', 'clarkson-s-farm', 'the-treet', 'suits', 'the-sopranos',
          'the-passion-of-the-christ', 'sound-of-freedom', 'supergirl', 'the-flash', 'invincible',
          'the-brave-and-the-bold', 'man-of-tomorrow', 'zack-snyder-s-justice-league',
          'godzilla-minus-zero', 'the-odyssey', 'wargames', 'contact', 'iron-man', 'lone-survivor'
        )`,
      );
      assert.equal(Number(newRatings.rows[0]?.n), 0);

      const green = await client.execute(
        "select kind, year, tmdb_id, tmdb_type, poster_path, episodes from media_item where id = 'green-book'",
      );
      assert.equal(green.rows[0]?.kind, "movie");
      assert.equal(green.rows[0]?.year, "2018");
      assert.equal(Number(green.rows[0]?.tmdb_id), 490132);
      assert.equal(green.rows[0]?.poster_path, "/7BsvSuDQuoqhWmU2fL7W2GOcZHU.jpg");
      assert.deepEqual(slugs(green.rows[0]?.episodes), [EP6, EP7]);

      const iron = await client.execute(
        "select title, year, tmdb_id, tmdb_type from media_item where id = 'iron-man'",
      );
      assert.equal(iron.rows[0]?.title, "Iron Man");
      assert.equal(iron.rows[0]?.year, "2008");
      assert.equal(Number(iron.rows[0]?.tmdb_id), 1726);
      assert.equal(iron.rows[0]?.tmdb_type, "movie");
      const ironMan2 = await client.execute(
        "select count(*) as n from media_item where lower(title) like 'iron man 2%' or tmdb_id = 10138",
      );
      assert.equal(Number(ironMan2.rows[0]?.n), 0);
      const greenMile = await client.execute(
        "select count(*) as n from media_item where lower(title) = 'the green mile'",
      );
      assert.equal(Number(greenMile.rows[0]?.n), 0);
      const flagged = await client.execute(
        `select count(*) as n from media_item
         where lower(title) like '%knightfall%'
            or lower(title) = 'black hawk down'
            or (lower(title) = 'batman' and (year like '1989%' or year like '1966%'))`,
      );
      assert.equal(Number(flagged.rows[0]?.n), 0);
      const trek = await client.execute(
        "select id from media_item where lower(title) like '%star trek%'",
      );
      assert.deepEqual(trek.rows.map((row) => row.id), ["star-trek-the-next-generation"]);

      const street = await client.execute("select title, tmdb_id from media_item where id = 'the-treet'");
      assert.equal(street.rows[0]?.title, "The $treet");
      assert.equal(Number(street.rows[0]?.tmdb_id), 1616);
      const brave = await client.execute(
        "select year, poster_path, wikipedia_url, tmdb_id from media_item where id = 'the-brave-and-the-bold'",
      );
      assert.equal(brave.rows[0]?.year, "upcoming");
      assert.equal(brave.rows[0]?.poster_path, null);
      assert.equal(brave.rows[0]?.wikipedia_url, null);
      assert.equal(Number(brave.rows[0]?.tmdb_id), 1081004);

      const lokiAfter = await client.execute(
        "select kind, title, year, wikipedia_url, tmdb_id, overview, poster_path, image, best_guess, sort_rank, created_at, updated_at from media_item where id = 'loki'",
      );
      assert.deepEqual(lokiAfter.rows, lokiBefore.rows);
      const lokiEpisodes = mentions(
        (await client.execute("select episodes from media_item where id = 'loki'")).rows[0]?.episodes,
      );
      assert.deepEqual(
        lokiEpisodes.slice(0, lokiEpisodesBefore.length),
        lokiEpisodesBefore,
      );
      assert.deepEqual(lokiEpisodes.slice(lokiEpisodesBefore.length).map((episode) => episode.slug), [EP6, EP7]);
      assert.equal(lokiEpisodes.find((episode) => episode.slug === EP6)?.title, EP6_TITLE);
      assert.equal(lokiEpisodes.find((episode) => episode.slug === EP7)?.title, EP7_TITLE);
      const lokiRating = await client.execute(
        "select rating from media_rating where media_item_id = 'loki' and host = 'john'",
      );
      assert.equal(lokiRating.rows[0]?.rating, "ok");

      const blade = mentions(
        (await client.execute("select episodes from media_item where id = 'blade-runner'")).rows[0]?.episodes,
      );
      assert.equal(blade.some((episode) => episode.timestamp === "01:53:27"), true);
      assert.equal(blade.some((episode) => episode.slug === EP7), true);
      assert.equal(blade.some((episode) => episode.slug === EP6), false);
      const partTwo = slugs(
        (await client.execute("select episodes from media_item where id = 'the-batman-part-ii'")).rows[0]?.episodes,
      );
      assert.equal(partTwo.includes(EP6), true);
      assert.equal(partTwo.includes(EP7), false);
      const wanda = slugs(
        (await client.execute("select episodes from media_item where id = 'wandavision'")).rows[0]?.episodes,
      );
      assert.equal(wanda.includes(EP7), true);
      assert.equal(wanda.includes(EP6), false);
      const vision = slugs(
        (await client.execute("select episodes from media_item where id = 'visionquest'")).rows[0]?.episodes,
      );
      assert.equal(vision.includes(EP6), true);
      assert.equal(vision.includes(EP7), true);
      const space = await client.execute(
        "select title, year, tmdb_id, poster_path, overview, episodes from media_item where id = '2001-a-space-odyssey'",
      );
      assert.equal(space.rows[0]?.title, odysseyBefore.rows[0]?.title);
      assert.equal(space.rows[0]?.year, odysseyBefore.rows[0]?.year);
      assert.equal(Number(space.rows[0]?.tmdb_id), Number(odysseyBefore.rows[0]?.tmdb_id));
      assert.equal(space.rows[0]?.poster_path, odysseyBefore.rows[0]?.poster_path);
      assert.equal(space.rows[0]?.overview, odysseyBefore.rows[0]?.overview);
      assert.deepEqual(slugs(space.rows[0]?.episodes), [EP7]);
      const avengersAfter = await client.execute("select episodes from media_item where id = 'avengers-doomsday'");
      assert.equal(avengersAfter.rows[0]?.episodes, avengersBefore.rows[0]?.episodes);

      const linked = [
        "visionquest",
        "loki",
        "superman",
        "man-of-steel",
        "the-batman-part-ii",
        "wandavision",
        "blade-runner-2099",
        "blade-runner",
        "blade-runner-2049",
        "2001-a-space-odyssey",
      ];
      const found = await client.execute(
        `select id from media_item where id in (${linked.map((id) => `'${id}'`).join(", ")})`,
      );
      assert.equal(found.rows.length, linked.length);

      await bootstrapSqliteSchema(client, files);
      const twice = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(twice.rows[0]?.n), 98);
      const lokiTwice = mentions(
        (await client.execute("select episodes from media_item where id = 'loki'")).rows[0]?.episodes,
      );
      assert.deepEqual(lokiTwice, lokiEpisodes);
      const oneIron = await client.execute("select count(*) as n from media_item where tmdb_id = 1726");
      assert.equal(Number(oneIron.rows[0]?.n), 1);

      await client.execute("delete from media_item where id = 'iron-man'");
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: ["0016_media_ep6_ep7.sql"],
      });
      await bootstrapSqliteSchema(client, files);
      const gone = await client.execute("select count(*) as n from media_item where id = 'iron-man'");
      assert.equal(Number(gone.rows[0]?.n), 0);
      const still = await client.execute(
        "select rating from media_rating where media_item_id = 'loki' and host = 'john'",
      );
      assert.equal(still.rows[0]?.rating, "ok");
      const lokiKept = mentions(
        (await client.execute("select episodes from media_item where id = 'loki'")).rows[0]?.episodes,
      );
      assert.deepEqual(lokiKept, lokiEpisodes);
    } finally {
      client.close();
    }
  });

  it("does not insert a second Iron Man when that title is already stored", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const prior = files.filter((file) => file.name !== "0016_media_ep6_ep7.sql");
      await bootstrapSqliteSchema(client, prior);
      await client.execute(`
        insert into media_item (
          id, kind, title, year, tmdb_id, tmdb_type, overview, episodes, sort_rank, created_at, updated_at
        ) values (
          'custom-iron-man', 'movie', 'Iron Man', '2008', 1726, 'movie', 'keep me', '[]', 0, 1, 1
        )
      `);
      await client.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('custom-iron-man', 'dan', 'two_up', 4)",
      );
      await bootstrapSqliteSchema(client, files);
      const rows = await client.execute(
        "select id, overview, episodes from media_item where lower(title) = 'iron man' or tmdb_id = 1726",
      );
      assert.equal(rows.rows.length, 1);
      assert.equal(rows.rows[0]?.id, "custom-iron-man");
      assert.equal(rows.rows[0]?.overview, "keep me");
      assert.deepEqual(slugs(rows.rows[0]?.episodes), [EP7]);
      const rating = await client.execute(
        "select rating from media_rating where media_item_id = 'custom-iron-man' and host = 'dan'",
      );
      assert.equal(rating.rows[0]?.rating, "two_up");
      const total = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(total.rows[0]?.n), 98);
    } finally {
      client.close();
    }
  });

  it("applies the episode 6 and 7 migration on the preview database", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite();
    try {
      await pg.waitReady;
      for (const file of migrationFiles()) {
        await pg.exec(file.sql);
      }
      const count = await pg.query<{ n: number }>("select count(*)::int as n from media_item");
      assert.equal(count.rows[0]?.n, 98);
      const ratings = await pg.query<{ n: number }>("select count(*)::int as n from media_rating");
      assert.equal(ratings.rows[0]?.n, 0);
      const green = await pg.query<{ episodes: string }>(
        "select episodes from media_item where id = 'green-book'",
      );
      assert.deepEqual(slugs(green.rows[0]?.episodes), [EP6, EP7]);
      await pg.exec(migrationFiles().find((file) => file.name === "0016_media_ep6_ep7.sql")!.sql);
      const again = await pg.query<{ n: number }>("select count(*)::int as n from media_item where id = 'green-book'");
      assert.equal(again.rows[0]?.n, 1);
      const loki = await pg.query<{ episodes: string }>("select episodes from media_item where id = 'loki'");
      const parsed = mentions(loki.rows[0]?.episodes);
      assert.equal(parsed.filter((episode) => episode.slug === EP6).length, 1);
      assert.equal(parsed.filter((episode) => episode.slug === EP7).length, 1);
    } finally {
      await pg.close();
    }
  });

  it("copies every rating when four and three thumbs are added", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const added = files.find((file) => file.name === "0017_media_rating_thumbs.sql");
      assert.ok(added);
      const statements = sqlStatements(toSqlite(added.sql));
      assert.equal(statements.length, 5);
      assert.match(statements[2] ?? "", /insert into media_rating_new select \* from media_rating/i);
      assert.doesNotMatch(added.sql, /\bupdate\s+media_rating\b/i);
      const prior = files.filter((file) => file.name !== added.name);
      await bootstrapSqliteSchema(client, prior);
      const expected = await seedRatingDistribution(client);
      assert.equal(expected.length, 139);
      const counts = new Map<string, number>();
      for (const row of expected) counts.set(row[2] ?? "", (counts.get(row[2] ?? "") ?? 0) + 1);
      assert.equal(counts.get("two_up"), 90);
      assert.equal(counts.get("one_up"), 12);
      assert.equal(counts.get("ok"), 14);
      assert.equal(counts.get("one_down"), 5);
      assert.equal(counts.get("two_down"), 2);
      assert.equal(counts.get("not_seen"), 16);

      await bootstrapSqliteSchema(client, files);
      assert.deepEqual(await readRatingRows(client), expected);
      const schema = String(
        (await client.execute("select sql from sqlite_master where type = 'table' and name = 'media_rating'"))
          .rows[0]?.sql,
      );
      assert.match(schema, /'four_up'/);
      assert.match(schema, /'three_up'/);
      assert.match(schema, /'two_up'/);
      assert.match(schema, /on delete cascade/i);
      assert.match(schema, /primary key/i);
      const leftover = await client.execute(
        "select name from sqlite_master where type = 'table' and name = 'media_rating_new'",
      );
      assert.equal(leftover.rows.length, 0);

      const before = await client.execute(
        "select rowid, media_item_id, host, rating, updated_at from media_rating order by rowid",
      );
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: [added.name],
      });
      await bootstrapSqliteSchema(client, files);
      const after = await client.execute(
        "select rowid, media_item_id, host, rating, updated_at from media_rating order by rowid",
      );
      assert.deepEqual(after.rows, before.rows);
      assert.deepEqual(await readRatingRows(client), expected);
      const applied = await client.execute({
        sql: "select count(*) as n from _migrations where name = ?",
        args: [added.name],
      });
      assert.equal(Number(applied.rows[0]?.n), 1);

      const items = await client.execute("select id from media_item order by id");
      const fresh = String(items.rows[70]?.id);
      const other = String(items.rows[71]?.id);
      assert.ok(fresh && other);
      await client.execute({
        sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, 'john', 'four_up', 4)",
        args: [fresh],
      });
      await client.execute({
        sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, 'dan', 'three_up', 3)",
        args: [fresh],
      });
      await client.execute({
        sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, 'john', 'two_up', 2)",
        args: [other],
      });
      const stored = await client.execute({
        sql: "select host, rating from media_rating where media_item_id = ? order by host",
        args: [fresh],
      });
      assert.deepEqual(
        stored.rows.map((row) => [row.host, row.rating]),
        [
          ["dan", "three_up"],
          ["john", "four_up"],
        ],
      );
      await assert.rejects(() =>
        client.execute({
          sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, 'dan', 'nope', 1)",
          args: [other],
        }),
      );
      await assert.rejects(() =>
        client.execute({
          sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, 'dan', 'unrated', 1)",
          args: [other],
        }),
      );
      const still = await client.execute({
        sql: "select rating from media_rating where media_item_id = ? and host = 'john'",
        args: [other],
      });
      assert.equal(still.rows[0]?.rating, "two_up");

      await client.execute("pragma foreign_keys = on");
      const cascadeId = String(items.rows[72]?.id);
      assert.ok(cascadeId);
      await client.execute({
        sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, 'dan', 'four_up', 8), (?, 'john', 'ok', 9)",
        args: [cascadeId, cascadeId],
      });
      await client.execute({ sql: "delete from media_item where id = ?", args: [cascadeId] });
      const gone = await client.execute({
        sql: "select count(*) as n from media_rating where media_item_id = ?",
        args: [cascadeId],
      });
      assert.equal(Number(gone.rows[0]?.n), 0);
      assert.deepEqual(await readRatingRows(client), [
        ...expected,
        [fresh, "dan", "three_up", "3"],
        [fresh, "john", "four_up", "4"],
        [other, "john", "two_up", "2"],
      ].sort((a, b) => a[0]!.localeCompare(b[0]!) || a[1]!.localeCompare(b[1]!)));
    } finally {
      client.close();
    }
  });

  it("finishes a partial rating rebuild without changing stored ratings", async () => {
    const client = memory();
    try {
      const files = migrationFiles();
      const added = files.find((file) => file.name === "0017_media_rating_thumbs.sql");
      assert.ok(added);
      const prior = files.filter((file) => file.name !== added.name);
      await bootstrapSqliteSchema(client, prior);
      await client.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'john', 'two_up', 5), ('loki', 'dan', 'not_seen', 6)",
      );
      const expected = await readRatingRows(client);
      await client.execute(`
        create table media_rating_new (
          media_item_id text not null references media_item (id) on delete cascade,
          host text not null check (host in ('john', 'dan')),
          rating text not null check (rating in ('four_up', 'three_up', 'two_up', 'one_up', 'ok', 'one_down', 'two_down', 'not_seen')),
          updated_at bigint not null,
          primary key (media_item_id, host)
        )
      `);
      await client.execute(
        "insert into media_rating_new (media_item_id, host, rating, updated_at) values ('alien', 'john', 'ok', 1)",
      );

      await bootstrapSqliteSchema(client, files);
      assert.deepEqual(await readRatingRows(client), expected);
      const tables = await client.execute(
        "select name from sqlite_master where type = 'table' and name in ('media_rating', 'media_rating_new')",
      );
      assert.deepEqual(
        tables.rows.map((row) => row.name),
        ["media_rating"],
      );

      await client.execute("delete from media_rating");
      await client.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'dan', 'one_down', 11)",
      );
      await client.execute({
        sql: "delete from _migrations where name = ?",
        args: [added.name],
      });
      const kept = await readRatingRows(client);
      await client.execute(`
        create table media_rating_new (
          media_item_id text not null references media_item (id) on delete cascade,
          host text not null check (host in ('john', 'dan')),
          rating text not null check (rating in ('four_up', 'three_up', 'two_up', 'one_up', 'ok', 'one_down', 'two_down', 'not_seen')),
          updated_at bigint not null,
          primary key (media_item_id, host)
        )
      `);
      await client.execute("insert into media_rating_new select * from media_rating");
      await client.execute("drop table media_rating");
      await bootstrapSqliteSchema(client, files);
      assert.deepEqual(await readRatingRows(client), kept);
      const renamed = await client.execute(
        "select name from sqlite_master where type = 'table' and name in ('media_rating', 'media_rating_new')",
      );
      assert.deepEqual(
        renamed.rows.map((row) => row.name),
        ["media_rating"],
      );
    } finally {
      client.close();
    }
  });

  it("lets two racing rebuilds keep the same ratings", async () => {
    const path = "/tmp/spacebat-rating-0017.db";
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
    const left = createClient({ url: `file:${path}`, timeout: 250 });
    const right = createClient({ url: `file:${path}`, timeout: 250 });
    try {
      const files = migrationFiles();
      const added = files.find((file) => file.name === "0017_media_rating_thumbs.sql");
      assert.ok(added);
      const prior = files.filter((file) => file.name < added.name);
      await bootstrapSqliteSchema(left, prior);
      await left.execute(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'john', 'two_up', 15), ('loki', 'dan', 'ok', 16)",
      );
      const expected = await readRatingRows(left);
      const throughRebuild = files.filter((file) => file.name <= added.name);
      await Promise.all([
        bootstrapSqliteSchema(left, throughRebuild),
        bootstrapSqliteSchema(right, throughRebuild),
      ]);
      assert.deepEqual(await readRatingRows(left), expected);
      assert.deepEqual(await readRatingRows(right), expected);
      const recorded = await left.execute({
        sql: "select count(*) as n from _migrations where name = ?",
        args: [added.name],
      });
      assert.equal(Number(recorded.rows[0]?.n), 1);
    } finally {
      left.close();
      right.close();
      rmSync(path, { force: true });
      rmSync(`${path}-wal`, { force: true });
      rmSync(`${path}-shm`, { force: true });
    }
  });

  it("rebuilds the rating check on the preview database without changing rows", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite();
    try {
      await pg.waitReady;
      const files = migrationFiles();
      const base = files.find((file) => file.name === "0012_media.sql");
      const added = files.find((file) => file.name === "0017_media_rating_thumbs.sql");
      assert.ok(base);
      assert.ok(added);
      await pg.exec(base.sql);
      await pg.exec(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'john', 'two_up', 21), ('loki', 'dan', 'not_seen', 22)",
      );
      await pg.exec(added.sql);
      const rows = await pg.query<{ media_item_id: string; host: string; rating: string; updated_at: string }>(
        "select media_item_id, host, rating, updated_at::text from media_rating order by media_item_id, host",
      );
      assert.deepEqual(
        rows.rows.map((row) => [row.media_item_id, row.host, row.rating, row.updated_at]),
        [
          ["alien", "john", "two_up", "21"],
          ["loki", "dan", "not_seen", "22"],
        ],
      );
      await pg.exec(added.sql);
      const again = await pg.query<{ n: number }>("select count(*)::int as n from media_rating");
      assert.equal(again.rows[0]?.n, 2);
      await pg.exec(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('alien', 'dan', 'four_up', 4)",
      );
      await pg.exec(
        "insert into media_rating (media_item_id, host, rating, updated_at) values ('loki', 'john', 'three_up', 3)",
      );
      await assert.rejects(() =>
        pg.exec(
          "insert into media_rating (media_item_id, host, rating, updated_at) values ('loki', 'dan', 'nope', 1)",
        ),
      );
      await pg.exec("delete from media_item where id = 'alien'");
      const left = await pg.query<{ n: number }>(
        "select count(*)::int as n from media_rating where media_item_id = 'alien'",
      );
      assert.equal(left.rows[0]?.n, 0);
      const kept = await pg.query<{ rating: string }>(
        "select rating from media_rating where media_item_id = 'loki' and host = 'dan'",
      );
      assert.equal(kept.rows[0]?.rating, "not_seen");
    } finally {
      await pg.close();
    }
  });
});

const EP6 = "ai-meltdown-europe-cracks-gunn-to-batman-s-head-quantum";
const EP7 = "vets-the-brave-and-the-bold-jensen-hung-dc-re-loads-tokenize-this";
const EP6_TITLE = "AI Meltdown, Europe Cracks, Gunn to Batman's Head, Quantum!?!";
const EP7_TITLE = 'Vets - The Brave and the Bold, Jensen "Hung", DC Re-Loads, Tokenize "This"';

function mentions(raw: unknown): { slug: string; title: string; timestamp?: string }[] {
  const parsed = JSON.parse(String(raw)) as { slug: string; title: string; timestamp?: string }[];
  assert.ok(Array.isArray(parsed));
  return parsed;
}

function slugs(raw: unknown): string[] {
  return mentions(raw).map((episode) => episode.slug);
}

const RATING_DISTRIBUTION = [
  ["two_up", 90],
  ["one_up", 12],
  ["ok", 14],
  ["one_down", 5],
  ["two_down", 2],
  ["not_seen", 16],
] as const;

async function seedRatingDistribution(client: Client): Promise<string[][]> {
  const items = await client.execute("select id from media_item order by id");
  const ids = items.rows.map((row) => String(row.id));
  assert.ok(ids.length >= 73);
  const expected: string[][] = [];
  let slot = 0;
  for (const [rating, count] of RATING_DISTRIBUTION) {
    for (let i = 0; i < count; i += 1) {
      const id = ids[Math.floor(slot / 2)];
      const host = slot % 2 === 0 ? "john" : "dan";
      const updated = 1_700_000_000_000 + slot;
      assert.ok(id);
      await client.execute({
        sql: "insert into media_rating (media_item_id, host, rating, updated_at) values (?, ?, ?, ?)",
        args: [id, host, rating, updated],
      });
      expected.push([id, host, rating, String(updated)]);
      slot += 1;
    }
  }
  assert.equal(slot, 139);
  expected.sort((a, b) => a[0]!.localeCompare(b[0]!) || a[1]!.localeCompare(b[1]!));
  return expected;
}

async function readRatingRows(client: Client): Promise<string[][]> {
  const result = await client.execute(
    "select media_item_id, host, rating, updated_at from media_rating order by media_item_id, host",
  );
  return result.rows.map((row) => [
    String(row.media_item_id),
    String(row.host),
    String(row.rating),
    String(row.updated_at),
  ]);
}

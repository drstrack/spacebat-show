import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import {
  addColumnTarget,
  applyPendingSqliteMigrations,
  bootstrapSqliteSchema,
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
      assert.equal(Number(count.rows[0]?.n), 79);
      const kinds = await client.execute(
        "select kind, count(*) as n from media_item group by kind order by kind",
      );
      assert.equal(Number(kinds.rows.find((row) => row.kind === "movie")?.n), 50);
      assert.equal(Number(kinds.rows.find((row) => row.kind === "tv")?.n), 29);
      const marker = await client.execute("select id, note from media_seed order by id");
      assert.equal(marker.rows.length, 3);
      assert.equal(marker.rows[0]?.note, "catalog-43");
      assert.equal(marker.rows[1]?.note, "2001-a-space-odyssey");
      assert.equal(marker.rows[2]?.note, "rescan-2026-11-01");
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
      assert.equal(Number(again.rows[0]?.n), 78);
      const alien = await client.execute("select count(*) as n from media_item where id = 'alien'");
      assert.equal(Number(alien.rows[0]?.n), 0);
      const markerAgain = await client.execute("select count(*) as n from media_seed");
      assert.equal(Number(markerAgain.rows[0]?.n), 3);

      await bootstrapSqliteSchema(client, files);
      const third = await client.execute("select count(*) as n from media_item");
      assert.equal(Number(third.rows[0]?.n), 78);
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
      const files = migrationFiles().filter((file) => file.name !== "0014_media_rescan.sql");
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
      const files = migrationFiles();
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
});

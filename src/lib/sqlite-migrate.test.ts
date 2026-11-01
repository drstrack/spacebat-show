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
});

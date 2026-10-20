import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@libsql/client";
import { POST_GAP_MS, POST_WINDOW_MAX } from "./chat/limits.ts";
import { POST_INSERT_SQL, postInsertParams } from "./chat/post-insert.ts";
import { bindLibsql } from "./sql-bind.ts";

describe("bindLibsql", () => {
  it("repeats an argument for every occurrence of its placeholder", () => {
    const bound = bindLibsql("select $2, $1, $2, $10", [
      "room",
      "user",
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      "tenth",
    ]);
    assert.equal(bound.sql, "select ?, ?, ?, ?");
    assert.deepEqual(bound.args, ["user", "room", "user", "tenth"]);
  });

  it("posts through the chat insert on an in-memory libsql database", async () => {
    const db = createClient({ url: ":memory:" });
    await db.execute(`
      create table chat_message (
        id integer primary key,
        room text not null,
        user_id text,
        kind text not null,
        body text not null,
        created_ms integer not null
      )
    `);

    const room = "main";
    const user = "user-1";
    async function insert(body: string, createdMs: number) {
      const bound = bindLibsql(POST_INSERT_SQL, postInsertParams(room, user, body, createdMs));
      assert.equal(bound.args.length, 11);
      const result = await db.execute({ sql: bound.sql, args: bound.args });
      const id = result.rows[0]?.id;
      return id == null ? null : Number(id);
    }

    const t0 = 1_700_000_000_000;
    assert.ok(await insert("one", t0));
    assert.equal(await insert("two", t0 + POST_GAP_MS - 1), null);
    assert.ok(await insert("three", t0 + POST_GAP_MS));

    const kept = await db.execute("select body from chat_message order by created_ms asc");
    assert.deepEqual(
      kept.rows.map((row) => row.body),
      ["one", "three"],
    );

    await db.execute("delete from chat_message");
    for (let n = 0; n < POST_WINDOW_MAX; n += 1) {
      await db.execute({
        sql: "insert into chat_message (room, user_id, kind, body, created_ms) values (?, ?, 'text', ?, ?)",
        args: [room, user, `seed-${n}`, t0 + n * 1_000],
      });
    }
    const newest = t0 + (POST_WINDOW_MAX - 1) * 1_000;
    assert.equal(await insert("over", newest + POST_GAP_MS), null);
    await db.execute("delete from chat_message where body = 'seed-0'");
    assert.ok(await insert("room", newest + POST_GAP_MS));
    db.close();
  });
});

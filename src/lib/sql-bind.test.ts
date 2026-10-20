import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@libsql/client";
import { POST_GAP_MS } from "./chat/limits.ts";
import { postAttemptSql, rateDecision, rateSnapshotSql } from "./chat/post-insert.ts";
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

  it("sends safe integers as bigint so Hrana uses an integer, not a float", () => {
    const bound = bindLibsql("select $1, $2", [1_700_000_000_000, 1.5]);
    assert.deepEqual(bound.args, [1_700_000_000_000n, 1.5]);
  });

  it("inserts at t, t+3000, and t+6000 on a bigint created_ms column", async () => {
    const db = createClient({ url: ":memory:" });
    await db.execute(`
      create table chat_message (
        id integer primary key,
        room text not null,
        user_id text,
        kind text not null,
        body text not null,
        created_ms bigint not null
      )
    `);
    await db.execute("create index chat_message_user_idx on chat_message (user_id, created_ms)");

    const room = "main";
    const user = "user-1";
    const t0 = 1_792_530_127_968;
    const attempt = postAttemptSql("sqlite", "cast($4 as integer)");

    async function insert(body: string, nowMs: number) {
      const bound = bindLibsql(attempt, [room, user, body, nowMs]);
      assert.equal(bound.args.length, bound.sql.split("?").length - 1);
      assert.equal(bound.args.filter((arg) => arg === BigInt(nowMs)).length, 1);
      const result = await db.execute({ sql: bound.sql, args: bound.args });
      const id = result.rows[0]?.id;
      return id == null ? null : Number(id);
    }

    assert.ok(await insert("one", t0));
    assert.equal(await insert("early", t0 + POST_GAP_MS - 1), null);
    assert.ok(await insert("two", t0 + POST_GAP_MS));
    assert.ok(await insert("three", t0 + POST_GAP_MS * 2));
    assert.ok(await insert("four", t0 + 10_000));

    const kept = await db.execute(
      "select body, created_ms, typeof(created_ms) as stored from chat_message order by created_ms asc",
    );
    assert.deepEqual(
      kept.rows.map((row) => [row.body, Number(row.created_ms), row.stored]),
      [
        ["one", t0, "integer"],
        ["two", t0 + 3_000, "integer"],
        ["three", t0 + 6_000, "integer"],
        ["four", t0 + 10_000, "integer"],
      ],
    );

    const raced = bindLibsql(attempt, [room, user, "race", t0 + 10_000]);
    const lost = await db.execute({ sql: raced.sql, args: raced.args });
    assert.equal(lost.rows.length, 0);

    const liveUser = "user-live";
    const liveInsert = bindLibsql(postAttemptSql("sqlite"), [room, liveUser, "live-1"]);
    const liveLook = bindLibsql(rateSnapshotSql("sqlite"), [liveUser, room]);
    const [firstSaved] = await db.batch(
      [
        { sql: liveInsert.sql, args: liveInsert.args },
        { sql: liveLook.sql, args: liveLook.args },
      ],
      "write",
    );
    assert.equal(firstSaved.rows.length, 1);
    const againInsert = bindLibsql(postAttemptSql("sqlite"), [room, liveUser, "live-2"]);
    const [secondSaved, secondRated] = await db.batch(
      [
        { sql: againInsert.sql, args: againInsert.args },
        { sql: liveLook.sql, args: liveLook.args },
      ],
      "write",
    );
    assert.equal(secondSaved.rows.length, 0);
    const refused = rateDecision(
      secondRated.rows.map((row) => ({ created_ms: row.created_ms, now_ms: row.now_ms })),
    );
    assert.ok(refused.waitMs != null && refused.waitMs <= POST_GAP_MS);
    assert.equal(refused.lastMs, Number(firstSaved.rows[0]?.created_ms));
    const liveKept = await db.execute({
      sql: "select count(*) as n from chat_message where user_id = ?",
      args: [liveUser],
    });
    assert.equal(Number(liveKept.rows[0]?.n), 1);

    const snap = bindLibsql(rateSnapshotSql("sqlite"), [user, room]);
    const clock = await db.execute({ sql: snap.sql, args: snap.args });
    assert.equal(clock.rows.length, 4);
    assert.equal(Number(clock.rows[0]?.created_ms), t0 + 10_000);
    assert.ok(Math.abs(Number(clock.rows[0]?.now_ms) - Date.now()) < 5_000);
    const decision = rateDecision(
      clock.rows.map((row) => ({ created_ms: row.created_ms, now_ms: row.now_ms })),
    );
    assert.equal(decision.lastMs, t0 + 10_000);
    assert.equal(decision.waitMs, null);

    db.close();
  });
});

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { POST_GAP_MS, POST_WINDOW_MAX } from "./limits.ts";
import { postAttemptSql, rateDecision, rateSnapshotSql } from "./post-insert.ts";

const ROOM = "main";
const USER = "user-1";
const ATTEMPT = postAttemptSql("postgres", "cast($4 as bigint)");

describe("post insert gap", () => {
  const db = new PGlite();

  after(async () => {
    await db.close();
  });

  it("stores t, t+3000, and t+6000 and refuses a shorter gap", async () => {
    await db.exec(`
      create table chat_message (
        id bigserial primary key,
        room text not null,
        user_id text,
        kind text not null,
        body text not null,
        created_ms bigint not null
      )
    `);

    const t0 = 1_700_000_000_000;
    assert.equal(await insert(db, "one", t0), true);
    assert.equal(await insert(db, "early", t0 + POST_GAP_MS - 1), false);
    assert.equal(await insert(db, "two", t0 + POST_GAP_MS), true);
    assert.equal(await insert(db, "three", t0 + POST_GAP_MS * 2), true);

    const kept = await db.query<{ body: string; created_ms: string | number | bigint }>(
      "select body, created_ms from chat_message order by created_ms asc",
    );
    assert.deepEqual(
      kept.rows.map((row) => [row.body, Number(row.created_ms)]),
      [
        ["one", t0],
        ["two", t0 + 3_000],
        ["three", t0 + 6_000],
      ],
    );

    const clock = await db.query<{
      now_ms: string | number | bigint;
      created_ms: string | number | bigint | null;
    }>(rateSnapshotSql("postgres"), [USER, ROOM]);
    assert.ok(Math.abs(Number(clock.rows[0]?.now_ms) - Date.now()) < 5_000);
    assert.equal(Number(clock.rows[0]?.created_ms), t0 + 6_000);
    const decision = rateDecision(
      clock.rows.map((row) => ({ created_ms: row.created_ms, now_ms: row.now_ms })),
    );
    assert.equal(decision.waitMs, null);
  });

  it("refuses once 20 text messages are still inside the minute", async () => {
    const user = "busy";
    const now = 1_700_000_200_000;
    for (let i = 0; i < POST_WINDOW_MAX; i += 1) {
      await db.query(
        "insert into chat_message (room, user_id, kind, body, created_ms) values ($1, $2, 'text', $3, $4::bigint)",
        [ROOM, user, `m${i}`, now - 50_000 + i * 1_000],
      );
    }
    assert.equal(await insert(db, "blocked", now, user), false);
    const kept = await db.query<{ n: number }>(
      "select count(*)::int as n from chat_message where user_id = $1",
      [user],
    );
    assert.equal(Number(kept.rows[0]?.n), POST_WINDOW_MAX);
  });
});

async function insert(db: PGlite, body: string, nowMs: number, user = USER) {
  const result = await db.query<{ id: number }>(ATTEMPT, [ROOM, user, body, nowMs]);
  return result.rows[0]?.id != null;
}

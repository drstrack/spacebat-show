import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { POST_GAP_MS } from "./limits.ts";
import { postInsertParams, postInsertSql, rateDecision, rateSnapshotSql } from "./post-insert.ts";

const ROOM = "main";
const USER = "user-1";

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
    assert.equal(await insert(db, "one", t0, null), true);
    assert.equal(await insert(db, "early", t0 + POST_GAP_MS - 1, t0), false);
    assert.equal(await insert(db, "two", t0 + POST_GAP_MS, t0), true);
    assert.equal(await insert(db, "three", t0 + POST_GAP_MS * 2, t0 + POST_GAP_MS), true);

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
  });
});

async function insert(db: PGlite, body: string, createdMs: number, lastMs: number | null) {
  const decision = rateDecision([{ created_ms: lastMs, now_ms: createdMs }]);
  if (decision.waitMs != null) return false;
  const result = await db.query<{ id: number }>(
    postInsertSql("postgres"),
    postInsertParams(ROOM, USER, body, createdMs, lastMs),
  );
  return result.rows[0]?.id != null;
}

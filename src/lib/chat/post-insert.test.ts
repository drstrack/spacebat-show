import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { POST_GAP_MS, POST_WINDOW_MAX } from "./limits.ts";
import { POST_INSERT_SQL, postInsertParams } from "./post-insert.ts";

const ROOM = "main";
const USER = "user-1";

async function insert(db: PGlite, body: string, createdMs: number) {
  const result = await db.query<{ id: number }>(
    POST_INSERT_SQL,
    postInsertParams(ROOM, USER, body, createdMs),
  );
  return result.rows[0]?.id ?? null;
}

describe("post insert gap", () => {
  const db = new PGlite();

  after(async () => {
    await db.close();
  });

  it("enforces the 3s gap and the per-minute cap", async () => {
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
    assert.ok(await insert(db, "one", t0));
    assert.equal(await insert(db, "two", t0 + POST_GAP_MS - 1), null);
    assert.ok(await insert(db, "three", t0 + POST_GAP_MS));

    const kept = await db.query<{ body: string }>(
      "select body from chat_message order by created_ms asc",
    );
    assert.deepEqual(
      kept.rows.map((row) => row.body),
      ["one", "three"],
    );

    await db.exec("delete from chat_message");
    for (let n = 0; n < POST_WINDOW_MAX; n += 1) {
      await db.query(
        "insert into chat_message (room, user_id, kind, body, created_ms) values ($1, $2, 'text', $3, $4)",
        [ROOM, USER, `seed-${n}`, t0 + n * 1_000],
      );
    }
    const newest = t0 + (POST_WINDOW_MAX - 1) * 1_000;
    assert.equal(await insert(db, "over", newest + POST_GAP_MS), null);
    await db.exec("delete from chat_message where body = 'seed-0'");
    assert.ok(await insert(db, "room", newest + POST_GAP_MS));
  });
});

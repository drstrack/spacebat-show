import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { PGlite } from "@electric-sql/pglite";
import { containsBlockedWord } from "./blockwords.ts";
import { postAttemptSql } from "./post-insert.ts";
import {
  listOnline,
  planBeat,
  PRESENCE_LEAVE_MS,
  PRESENCE_REJOIN_MS,
  presenceBody,
  pulsePresence,
  touchPresence,
  type PresenceSnapshot,
} from "./presence.ts";
import { bindLibsql } from "../sql-bind.ts";

const T0 = 1_700_000_000_000;

type Row = Record<string, unknown>;
type PresenceSql = {
  <T = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

function here(lastSeenMs: number, sessionMs: number | null = lastSeenMs): PresenceSnapshot {
  return { lastSeenMs, state: "here", sessionMs, leftMs: null };
}

describe("planBeat", () => {
  it("joins someone the room has never seen", () => {
    assert.equal(planBeat(null, T0).type, "insert-join");
  });

  it("refreshes a second tab, a refresh, and a short blip", () => {
    assert.equal(planBeat(here(T0), T0 + 1_000).type, "refresh");
    assert.equal(planBeat(here(T0), T0 + 30_000).type, "refresh");
    assert.equal(planBeat(here(T0), T0 + PRESENCE_LEAVE_MS - 1).type, "refresh");
  });

  it("announces a leave without a new join inside the rejoin window", () => {
    const plan = planBeat(here(T0), T0 + PRESENCE_LEAVE_MS);
    assert.equal(plan.type, "leave");
    if (plan.type === "leave") assert.equal(plan.then, "resume");
    const later = planBeat(here(T0), T0 + PRESENCE_REJOIN_MS - 1);
    assert.equal(later.type, "leave");
    if (later.type === "leave") assert.equal(later.then, "resume");
  });

  it("announces a leave and a join once they have been gone a few minutes", () => {
    const plan = planBeat(here(T0), T0 + PRESENCE_REJOIN_MS);
    assert.equal(plan.type, "leave");
    if (plan.type === "leave") assert.equal(plan.then, "join");
  });

  it("does not join again when a leave was already posted and they come back soon", () => {
    const plan = planBeat(
      { lastSeenMs: T0, state: "gone", sessionMs: T0, leftMs: T0 + PRESENCE_LEAVE_MS },
      T0 + PRESENCE_LEAVE_MS + 30_000,
    );
    assert.equal(plan.type, "resume");
  });

  it("joins again after the rejoin window", () => {
    const plan = planBeat(
      { lastSeenMs: T0, state: "gone", sessionMs: T0, leftMs: T0 + PRESENCE_LEAVE_MS },
      T0 + PRESENCE_REJOIN_MS,
    );
    assert.equal(plan.type, "insert-join");
  });
});

describe("presence copy", () => {
  it("uses the room name and does not pass through the blocked-word filter", () => {
    const body = presenceBody("ass", "join");
    assert.equal(body, "ass joined the chat");
    assert.equal(containsBlockedWord(body, ["ass"]), "ass");
    assert.equal(presenceBody("  Dan  ", "leave"), "Dan left the chat");
    assert.equal(presenceBody("   ", "join"), "Someone joined the chat");
  });
});

const POSTGRES_SCHEMA = `
  create table "user" (
    id text primary key,
    name text not null,
    email text not null,
    image text
  );
  create table chat_member (
    user_id text primary key,
    handle text not null,
    banned_ms bigint
  );
  create table chat_presence (
    user_id text primary key,
    room text not null default 'main',
    last_seen_ms bigint not null,
    state text not null,
    session_ms bigint,
    left_ms bigint
  );
  create table chat_message (
    id bigserial primary key,
    room text not null default 'main',
    user_id text,
    kind text not null default 'text',
    body text not null,
    created_ms bigint not null,
    deleted_ms bigint,
    deleted_by text,
    event_key text unique
  );
`;

const SQLITE_SCHEMA = POSTGRES_SCHEMA.replace(/\bbigserial\b/gi, "integer");

type Stored = { body: string; kind: string; userId: string | null };

function pgSql(db: PGlite): PresenceSql {
  return (async (strings, ...values) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await db.query<Row>(text, values);
    return result.rows;
  }) as PresenceSql;
}

function liteSql(client: Client): PresenceSql {
  return (async (strings, ...values) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const bound = bindLibsql(text, values);
    const result = await client.execute({ sql: bound.sql, args: bound.args });
    return result.rows as unknown as Row[];
  }) as PresenceSql;
}

async function names(sql: PresenceSql, userId: string, handle: string): Promise<void> {
  await sql`insert into chat_member (user_id, handle) values (${userId}, ${handle})`;
}

async function lines(sql: PresenceSql): Promise<Stored[]> {
  const rows = await sql<{ body: string; kind: string; user_id: string | null }>`
    select body, kind, user_id from chat_message order by id asc
  `;
  return rows.map((row) => ({
    body: row.body,
    kind: row.kind,
    userId: row.user_id,
  }));
}

function presenceSuite(open: () => Promise<{ sql: PresenceSql; close: () => Promise<void> }>) {
  it("posts one join for the first heartbeat, including a second tab", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await touchPresence(sql, "dan", "Dan", T0);
      await touchPresence(sql, "dan", "Dan", T0 + 1_000);
      await Promise.all([
        touchPresence(sql, "dan", "Dan", T0 + 2_000),
        touchPresence(sql, "dan", "Dan", T0 + 2_000),
      ]);
      const stored = await lines(sql);
      assert.deepEqual(stored, [{ body: "Dan joined the chat", kind: "presence", userId: null }]);
    } finally {
      await close();
    }
  });

  it("stays quiet across a refresh", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await touchPresence(sql, "dan", "Dan", T0);
      await touchPresence(sql, "dan", "Dan", T0 + 30_000);
      assert.deepEqual(
        (await lines(sql)).map((row) => row.body),
        ["Dan joined the chat"],
      );
    } finally {
      await close();
    }
  });

  it("posts a leave without a re-join when they return inside a few minutes", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await touchPresence(sql, "dan", "Dan", T0);
      await touchPresence(sql, "dan", "Dan", T0 + PRESENCE_LEAVE_MS + 15_000);
      assert.deepEqual(
        (await lines(sql)).map((row) => row.body),
        ["Dan joined the chat", "Dan left the chat"],
      );
    } finally {
      await close();
    }
  });

  it("posts a leave and a join after they have been gone longer than that", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await touchPresence(sql, "dan", "Dan", T0);
      await touchPresence(sql, "dan", "Dan", T0 + PRESENCE_REJOIN_MS + 1_000);
      assert.deepEqual(
        (await lines(sql)).map((row) => row.body),
        ["Dan joined the chat", "Dan left the chat", "Dan joined the chat"],
      );
    } finally {
      await close();
    }
  });

  it("lets someone else in the room announce the leave after the tab closes", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await names(sql, "sam", "Sam");
      await touchPresence(sql, "dan", "Dan", T0);
      await touchPresence(sql, "sam", "Sam", T0 + PRESENCE_LEAVE_MS - 5_000);
      await touchPresence(sql, "sam", "Sam", T0 + PRESENCE_LEAVE_MS);
      assert.deepEqual(
        (await lines(sql)).map((row) => row.body),
        ["Dan joined the chat", "Sam joined the chat", "Dan left the chat"],
      );
    } finally {
      await close();
    }
  });

  it("treats a closed tab as a leave once the timeout has already elapsed", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await touchPresence(sql, "dan", "Dan", T0);
      await pulsePresence(sql, "dan", T0 + 30_000);
      await pulsePresence(sql, "dan", T0 + PRESENCE_REJOIN_MS + 1_000);
      assert.deepEqual(
        (await lines(sql)).map((row) => row.body),
        ["Dan joined the chat", "Dan left the chat"],
      );
    } finally {
      await close();
    }
  });

  it("lists members still inside the leave window, by name, without emails", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "Dan");
      await names(sql, "sam", "Sam");
      await names(sql, "bea", "Bea");
      await names(sql, "ada", "Ada");
      await sql`
        insert into "user" (id, name, email, image) values
          (${"dan"}, ${"Dan Account"}, ${"dan@secret.test"}, ${"https://cdn.example/dan.png"}),
          (${"sam"}, ${"Sam Account"}, ${"sam@secret.test"}, ${"javascript:alert(1)"})
      `;
      await touchPresence(sql, "dan", "Dan", T0);
      await touchPresence(sql, "sam", "Sam", T0);
      await touchPresence(sql, "bea", "Bea", T0);
      await touchPresence(sql, "ada", "Ada", T0);
      await sql`update chat_member set banned_ms = ${T0} where user_id = ${"bea"}`;
      await sql`update chat_presence set state = 'gone' where user_id = ${"ada"}`;

      const fresh = await listOnline(sql, "dan", T0 + PRESENCE_LEAVE_MS - 1);
      assert.deepEqual(
        fresh.map((member) => member.handle),
        ["Dan", "Sam"],
      );
      assert.equal(fresh[0]?.you, true);
      assert.equal(fresh[1]?.you, false);
      assert.equal(fresh[0]?.imageUrl, "https://cdn.example/dan.png");
      assert.equal(fresh[1]?.imageUrl, null);
      const packed = JSON.stringify(fresh);
      assert.equal(packed.includes("secret"), false);
      assert.equal(packed.includes("dan@"), false);
      assert.equal(packed.includes("user_id"), false);

      const stale = await listOnline(sql, "dan", T0 + PRESENCE_LEAVE_MS);
      assert.deepEqual(stale, []);
    } finally {
      await close();
    }
  });

  it("stores a blocked-word name and does not count the line as that member's post", async () => {
    const { sql, close } = await open();
    try {
      await names(sql, "dan", "ass");
      await touchPresence(sql, "dan", "ass", T0);
      const stored = await lines(sql);
      assert.equal(stored[0]?.body, "ass joined the chat");
      assert.equal(stored[0]?.kind, "presence");
      assert.equal(stored[0]?.userId, null);
      assert.equal(containsBlockedWord(stored[0]?.body ?? "", ["ass"]), "ass");
    } finally {
      await close();
    }
  });
}

describe("presence on postgres", () => {
  presenceSuite(async () => {
    const db = new PGlite();
    await db.exec(POSTGRES_SCHEMA);
    return {
      sql: pgSql(db),
      close: () => db.close(),
    };
  });

  it("does not consume the text-message rate limit", async () => {
    const db = new PGlite();
    try {
      await db.exec(POSTGRES_SCHEMA);
      const sql = pgSql(db);
      await names(sql, "dan", "Dan");
      await touchPresence(sql, "dan", "Dan", T0);
      await sql`
      insert into chat_message (room, user_id, kind, body, created_ms, event_key)
      values ('main', 'dan', 'presence', 'Dan joined the chat', ${T0}, 'extra-presence')
    `;
      const inserted = await db.query<{ id: number }>(
        postAttemptSql("postgres", "cast($4 as bigint)"),
        ["main", "dan", "hello", T0 + 10_000],
      );
      assert.ok(inserted.rows[0]?.id != null);
      const texts = await db.query<{ n: number }>(
        "select count(*)::int as n from chat_message where user_id = 'dan' and kind = 'text'",
      );
      assert.equal(Number(texts.rows[0]?.n), 1);
    } finally {
      await db.close();
    }
  });
});

describe("presence on sqlite", () => {
  presenceSuite(async () => {
    const client = createClient({ url: ":memory:" });
    await client.executeMultiple(SQLITE_SCHEMA);
    return {
      sql: liteSql(client),
      close: async () => {
        client.close();
      },
    };
  });
});

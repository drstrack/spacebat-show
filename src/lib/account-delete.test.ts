import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { presenceBody } from "./chat/presence.ts";
import { bindLibsql } from "./sql-bind.ts";
import type { Sql } from "./db.ts";
import {
  DELETED_ACCOUNT_LABEL,
  accountLabel,
  applyConfirmedRemoval,
  chatAuthorLabel,
  deleteOwnAccount,
  deletedPresenceLine,
  removeMemberAccount,
  type ConfirmGesture,
} from "./account-delete.ts";

const SCHEMA = `
create table "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" integer not null default 0,
  "createdAt" text not null,
  "updatedAt" text not null
);
create table "session" (
  id text primary key,
  "expiresAt" text not null,
  token text not null unique,
  "createdAt" text not null,
  "updatedAt" text not null,
  "userId" text not null references "user" (id) on delete cascade
);
create table "account" (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" (id) on delete cascade,
  password text,
  "createdAt" text not null,
  "updatedAt" text not null
);
create table "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" text not null,
  "createdAt" text not null,
  "updatedAt" text not null
);
create table member_profile (
  user_id text primary key references "user" (id) on delete cascade,
  role text not null
);
create table chat_member (
  user_id text primary key references "user" (id) on delete cascade,
  handle text not null
);
create table chat_message (
  id integer primary key,
  room text not null default 'main',
  user_id text,
  kind text not null default 'text',
  body text not null,
  created_ms integer not null,
  event_key text unique
);
create table chat_upload (
  id integer primary key,
  message_id integer,
  user_id text not null,
  url text not null,
  pathname text not null unique,
  original_name text not null,
  size integer not null,
  content_type text not null,
  kind text not null,
  created_ms integer not null
);
create table chat_presence (
  user_id text primary key,
  room text not null,
  last_seen_ms integer not null,
  state text not null
);
`;

function memorySql(client: Client): Sql {
  const run = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
    const bound = bindLibsql(text, params);
    const result = await client.execute({ sql: bound.sql, args: bound.args });
    return result.rows as unknown as T[];
  };
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as Sql;
  sql.query = (text, params = []) => run(text, params);
  sql.batch = async (statements) => {
    const results = await client.batch(
      statements.map((statement) => {
        const bound = bindLibsql(statement.text, statement.params ?? []);
        return { sql: bound.sql, args: bound.args };
      }),
      "write",
    );
    return results.map((result) => result.rows as unknown[]);
  };
  return sql;
}

async function openDb(): Promise<{ sql: Sql; close: () => void }> {
  const client = createClient({ url: ":memory:" });
  await client.execute("pragma foreign_keys = on");
  await client.executeMultiple(SCHEMA);
  return { sql: memorySql(client), close: () => client.close() };
}

async function addPerson(
  sql: Sql,
  person: { id: string; name: string; email: string; role: "admin" | "listener"; handle: string },
): Promise<void> {
  const now = "2026-01-01T00:00:00.000Z";
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${person.id}, ${person.name}, ${person.email}, 1, ${now}, ${now})
  `;
  await sql`
    insert into "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
    values (${`session-${person.id}`}, ${now}, ${`token-${person.id}`}, ${now}, ${now}, ${person.id})
  `;
  await sql`
    insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
    values (${`account-${person.id}`}, ${person.email}, 'credential', ${person.id}, 'hash', ${now}, ${now})
  `;
  await sql`
    insert into "verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
    values (${`verify-${person.id}`}, ${person.email}, 'reset', ${now}, ${now}, ${now})
  `;
  await sql`insert into member_profile (user_id, role) values (${person.id}, ${person.role})`;
  await sql`insert into chat_member (user_id, handle) values (${person.id}, ${person.handle})`;
  await sql`
    insert into chat_presence (user_id, room, last_seen_ms, state)
    values (${person.id}, 'main', 1000, 'here')
  `;
}

async function ids(sql: Sql, table: string, column = "id"): Promise<string[]> {
  const rows = await sql.query<{ id: string }>(`select ${column} as id from ${table} order by 1`);
  return rows.map((row) => String(row.id));
}

async function userIds(sql: Sql): Promise<string[]> {
  return ids(sql, '"user"');
}

describe("confirmation gesture", () => {
  it("cancel, escape, and outside click do not delete", async () => {
    for (const gesture of ["cancel", "escape", "outside"] as const) {
      let called = false;
      const result = await applyConfirmedRemoval(gesture, async () => {
        called = true;
        return "deleted";
      });
      assert.equal(result, null);
      assert.equal(called, false);
    }
  });

  it("only confirm runs the removal", async () => {
    const result = await applyConfirmedRemoval("confirm", async () => "deleted");
    assert.equal(result, "deleted");
  });
});

describe("labels", () => {
  it("names the account and the deleted-author label", () => {
    assert.equal(accountLabel("Ada Wing", "ada@example.com"), "Ada Wing (ada@example.com)");
    assert.equal(accountLabel("ada@example.com", "ada@example.com"), "ada@example.com");
    assert.equal(accountLabel("", ""), "this account");
    assert.equal(deletedPresenceLine("join"), presenceBody(DELETED_ACCOUNT_LABEL, "join"));
    assert.equal(deletedPresenceLine("leave"), presenceBody(DELETED_ACCOUNT_LABEL, "leave"));
    assert.equal(
      chatAuthorLabel({ kind: "text", userId: null, handle: null }),
      DELETED_ACCOUNT_LABEL,
    );
    assert.equal(chatAuthorLabel({ kind: "text", userId: "still-here", handle: null }), "Listener");
    assert.equal(chatAuthorLabel({ kind: "text", userId: "still-here", handle: "Ada" }), "Ada");
    assert.equal(chatAuthorLabel({ kind: "system", userId: null, handle: null }), "SpaceBat");
    assert.equal(chatAuthorLabel({ kind: "presence", userId: null, handle: null }), "");
  });
});

describe("admin remove", () => {
  async function room() {
    const db = await openDb();
    await addPerson(db.sql, {
      id: "admin",
      name: "Crew",
      email: "crew@example.com",
      role: "admin",
      handle: "Crew",
    });
    await addPerson(db.sql, {
      id: "ada",
      name: "Ada Wing",
      email: "ada@example.com",
      role: "listener",
      handle: "Ada",
    });
    await addPerson(db.sql, {
      id: "bea",
      name: "Bea Bat",
      email: "bea@example.com",
      role: "listener",
      handle: "Bea",
    });
    await db.sql`
      insert into chat_message (id, user_id, kind, body, created_ms, event_key)
      values
        (1, 'ada', 'text', 'hello from ada', 10, null),
        (2, 'bea', 'text', 'hello from bea', 11, null),
        (3, null, 'presence', 'Ada joined the chat', 12, 'presence:join:ada:1000'),
        (4, null, 'presence', 'Bea left the chat', 13, 'presence:leave:bea:2000'),
        (5, null, 'system', 'SpaceBat is live', 14, 'live:1')
    `;
    await db.sql`
      insert into chat_upload (
        id, message_id, user_id, url, pathname, original_name, size, content_type, kind, created_ms
      ) values
        (1, null, 'ada', 'https://example.test/draft', 'draft', 'draft.png', 10, 'image/png', 'image', 10),
        (2, 1, 'ada', 'https://example.test/posted', 'posted', 'posted.png', 11, 'image/png', 'image', 11),
        (3, 2, 'bea', 'https://example.test/bea', 'bea', 'bea.png', 12, 'image/png', 'image', 12)
    `;
    return db;
  }

  async function click(
    sql: Sql,
    gesture: ConfirmGesture,
    targetId = "ada",
    lockedEmails: ReadonlySet<string> = new Set(),
  ) {
    return applyConfirmedRemoval(gesture, () =>
      removeMemberAccount(sql, { actorId: "admin", targetId, lockedEmails }),
    );
  }

  it("cancel, escape, and outside click leave every account", async () => {
    for (const gesture of ["cancel", "escape", "outside"] as const) {
      const db = await room();
      try {
        const before = await userIds(db.sql);
        const result = await click(db.sql, gesture);
        assert.equal(result, null);
        assert.deepEqual(await userIds(db.sql), before);
        assert.deepEqual(await ids(db.sql, '"session"', '"userId"'), ["ada", "admin", "bea"]);
        assert.deepEqual(await ids(db.sql, '"account"', '"userId"'), ["ada", "admin", "bea"]);
      } finally {
        db.close();
      }
    }
  });

  it("confirm deletes only the named account, sessions, and credentials", async () => {
    const db = await room();
    try {
      const result = await click(db.sql, "confirm");
      assert.equal(result, undefined);
      assert.deepEqual(await userIds(db.sql), ["admin", "bea"]);
      assert.deepEqual(await ids(db.sql, '"session"', '"userId"'), ["admin", "bea"]);
      assert.deepEqual(await ids(db.sql, '"account"', '"userId"'), ["admin", "bea"]);
      assert.deepEqual(await ids(db.sql, "member_profile", "user_id"), ["admin", "bea"]);
      assert.deepEqual(await ids(db.sql, "chat_member", "user_id"), ["admin", "bea"]);
      assert.deepEqual(await ids(db.sql, "chat_presence", "user_id"), ["admin", "bea"]);
      assert.deepEqual(await ids(db.sql, '"verification"', "identifier"), [
        "bea@example.com",
        "crew@example.com",
      ]);

      const messages = await db.sql<{
        id: number;
        user_id: string | null;
        kind: string;
        body: string;
      }>`select id, user_id, kind, body from chat_message order by id`;
      assert.deepEqual(
        messages.map((row) => [Number(row.id), row.user_id, row.kind, row.body]),
        [
          [1, null, "text", "hello from ada"],
          [2, "bea", "text", "hello from bea"],
          [3, null, "presence", deletedPresenceLine("join")],
          [4, null, "presence", "Bea left the chat"],
          [5, null, "system", "SpaceBat is live"],
        ],
      );
      assert.equal(
        chatAuthorLabel({ kind: "text", userId: messages[0]?.user_id ?? null, handle: null }),
        DELETED_ACCOUNT_LABEL,
      );

      const uploads = await db.sql<{ id: number; user_id: string; message_id: number | null }>`
        select id, user_id, message_id from chat_upload order by id
      `;
      assert.deepEqual(
        uploads.map((row) => [
          Number(row.id),
          row.user_id,
          row.message_id == null ? null : Number(row.message_id),
        ]),
        [
          [2, "ada", 1],
          [3, "bea", 2],
        ],
      );
    } finally {
      db.close();
    }
  });

  it("refuses a non-admin, the actor, a locked account, and the last admin", async () => {
    const db = await openDb();
    try {
      await addPerson(db.sql, {
        id: "admin",
        name: "Crew",
        email: "crew@example.com",
        role: "admin",
        handle: "Crew",
      });
      await addPerson(db.sql, {
        id: "ada",
        name: "Ada Wing",
        email: "ada@example.com",
        role: "listener",
        handle: "Ada",
      });
      await addPerson(db.sql, {
        id: "show",
        name: "Show",
        email: "spacebatshow@gmail.com",
        role: "admin",
        handle: "Show",
      });

      await assert.rejects(
        () =>
          removeMemberAccount(db.sql, {
            actorId: "ada",
            targetId: "admin",
            lockedEmails: new Set(),
          }),
        /Crew only/,
      );
      assert.deepEqual(await userIds(db.sql), ["ada", "admin", "show"]);

      await assert.rejects(
        () =>
          removeMemberAccount(db.sql, {
            actorId: "admin",
            targetId: "admin",
            lockedEmails: new Set(),
          }),
        /That account stays/,
      );

      await assert.rejects(
        () =>
          removeMemberAccount(db.sql, {
            actorId: "admin",
            targetId: "show",
            lockedEmails: new Set(["spacebatshow@gmail.com"]),
          }),
        /That account stays/,
      );

      await removeMemberAccount(db.sql, {
        actorId: "admin",
        targetId: "show",
        lockedEmails: new Set(),
      });
      await assert.rejects(() => deleteOwnAccount(db.sql, "admin"), /The last admin stays/);
      assert.deepEqual(await userIds(db.sql), ["ada", "admin"]);
      assert.deepEqual(await ids(db.sql, '"session"', '"userId"'), ["ada", "admin"]);
    } finally {
      db.close();
    }
  });
});

describe("self-delete", () => {
  async function pair() {
    const db = await openDb();
    await addPerson(db.sql, {
      id: "ada",
      name: "Ada Wing",
      email: "ada@example.com",
      role: "listener",
      handle: "Ada",
    });
    await addPerson(db.sql, {
      id: "bea",
      name: "Bea Bat",
      email: "bea@example.com",
      role: "admin",
      handle: "Bea",
    });
    await db.sql`
      insert into chat_message (id, user_id, kind, body, created_ms)
      values (1, 'ada', 'text', 'ada post', 10), (2, 'bea', 'text', 'bea post', 11)
    `;
    return db;
  }

  it("cancel leaves the session user in place", async () => {
    const db = await pair();
    try {
      for (const gesture of ["cancel", "escape", "outside"] as const) {
        const result = await applyConfirmedRemoval(gesture, () => deleteOwnAccount(db.sql, "ada"));
        assert.equal(result, null);
      }
      assert.deepEqual(await userIds(db.sql), ["ada", "bea"]);
      assert.deepEqual(await ids(db.sql, '"session"', '"userId"'), ["ada", "bea"]);
      assert.deepEqual(await ids(db.sql, '"account"', '"userId"'), ["ada", "bea"]);
    } finally {
      db.close();
    }
  });

  it("confirm deletes only the session user, their sessions, and their accounts", async () => {
    const db = await pair();
    try {
      await applyConfirmedRemoval("confirm", () => deleteOwnAccount(db.sql, "ada"));
      assert.deepEqual(await userIds(db.sql), ["bea"]);
      assert.deepEqual(await ids(db.sql, '"session"', '"userId"'), ["bea"]);
      assert.deepEqual(await ids(db.sql, '"account"', '"userId"'), ["bea"]);
      const messages = await db.sql<{ user_id: string | null; body: string }>`
        select user_id, body from chat_message order by id
      `;
      assert.deepEqual(
        messages.map((row) => [row.user_id, row.body]),
        [
          [null, "ada post"],
          ["bea", "bea post"],
        ],
      );
    } finally {
      db.close();
    }
  });

  it("rejects an unauthenticated call and deletes nobody", async () => {
    const db = await pair();
    try {
      await assert.rejects(
        () => applyConfirmedRemoval("confirm", () => deleteOwnAccount(db.sql, null)),
        /Unauthorized/,
      );
      await assert.rejects(() => deleteOwnAccount(db.sql, undefined), /Unauthorized/);
      await assert.rejects(() => deleteOwnAccount(db.sql, ""), /Unauthorized/);
      assert.deepEqual(await userIds(db.sql), ["ada", "bea"]);
      assert.deepEqual(await ids(db.sql, '"session"', '"userId"'), ["ada", "bea"]);
    } finally {
      db.close();
    }
  });

  it("lets a second admin delete themselves and then keeps the last one", async () => {
    const db = await openDb();
    try {
      await addPerson(db.sql, {
        id: "ada",
        name: "Ada",
        email: "ada@example.com",
        role: "admin",
        handle: "Ada",
      });
      await addPerson(db.sql, {
        id: "bea",
        name: "Bea",
        email: "bea@example.com",
        role: "admin",
        handle: "Bea",
      });
      await deleteOwnAccount(db.sql, "ada");
      assert.deepEqual(await userIds(db.sql), ["bea"]);
      await assert.rejects(() => deleteOwnAccount(db.sql, "bea"), /The last admin stays/);
      assert.deepEqual(await userIds(db.sql), ["bea"]);
      assert.deepEqual(await ids(db.sql, '"account"', '"userId"'), ["bea"]);
    } finally {
      db.close();
    }
  });
});

describe("self-delete server function", () => {
  it("takes the user id from the session and not from client input", () => {
    const source = readFileSync(new URL("./account.functions.ts", import.meta.url), "utf8");
    const start = source.indexOf("export const deleteMyAccount");
    assert.ok(start > 0);
    const block = source.slice(start);
    assert.match(block, /authMiddleware/);
    assert.match(block, /deleteOwnAccount\(sql, context\.userId\)/);
    assert.doesNotMatch(block, /validator/);
    assert.doesNotMatch(block, /data\.userId/);
    assert.doesNotMatch(block, /input\.userId/);
  });
});

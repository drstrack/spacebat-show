import { pendingMigrations } from "../../scripts/migration-plan.mjs";

/**
 * Postgres migration files also run on Turso, which is SQLite.
 * `ADD COLUMN IF NOT EXISTS` is not in this list: libSQL rejects it.
 */
export function toSqlite(sqlText: string): string {
  return sqlText
    .replace(/\btimestamptz\b/gi, "text")
    .replace(/\bboolean\b/gi, "integer")
    .replace(/\bbigserial\b/gi, "integer")
    .replace(/\bdate\b/gi, "text")
    .replace(/\bdefault\s+true\b/gi, "default 1")
    .replace(/\bdefault\s+false\b/gi, "default 0")
    .replace(/\bdefault\s+now\(\)/gi, "default (datetime('now'))")
    .replace(/\bdefault\s+current_date\b/gi, "default (date('now'))")
    .replace(/\bnow\(\)/gi, "datetime('now')");
}

export function sqlStatements(sqlText: string): string[] {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part && !part.split("\n").every((line) => !line.trim() || line.trim().startsWith("--")),
    );
}

export type MigrationClient = {
  execute(
    statement: string | { sql: string; args?: readonly unknown[] },
  ): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
  /**
   * One immediate write transaction on a single connection.
   * LibSQL `transaction("write")` is BEGIN IMMEDIATE. A plain `execute()`
   * borrows a different connection, so a BEGIN written in the SQL file does
   * not cover the later statements on Turso.
   */
  transaction?(mode?: "write" | "read" | "deferred"): Promise<MigrationTransaction>;
};

export type MigrationTransaction = {
  execute(statement: string): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

const ADD_COLUMN =
  /^alter\s+table\s+(?:"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))\s+add\s+column\s+(?:"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))\b/i;

/** `ALTER TABLE ... ADD COLUMN ...`, or null when the statement is something else. */
export function addColumnTarget(statement: string): { table: string; column: string } | null {
  const sql = statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
  const match = ADD_COLUMN.exec(sql);
  if (!match) return null;
  const table = match[1] || match[2];
  const column = match[3] || match[4];
  if (!table || !column) return null;
  return { table, column };
}

function columnName(row: Record<string, unknown>): string {
  const value = row.name ?? row.NAME;
  return String(value ?? "").toLowerCase();
}

async function tableColumns(client: MigrationClient, table: string): Promise<Set<string>> {
  const result = await client.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
  const names = new Set<string>();
  for (const row of result.rows) {
    const name = columnName(row);
    if (name) names.add(name);
  }
  return names;
}

function isDuplicateColumn(err: unknown): boolean {
  const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
  return /duplicate column/i.test(message);
}

/**
 * Run one migration file's statements. An ADD COLUMN whose name is already
 * on the table is skipped, so a retry after a partial apply does not fail
 * boot. The caller records `_migrations` only after this returns.
 */
export async function applySqliteMigration(client: MigrationClient, sqlText: string): Promise<void> {
  for (const statement of sqlStatements(toSqlite(sqlText))) {
    const add = addColumnTarget(statement);
    if (add) {
      const columns = await tableColumns(client, add.table);
      if (columns.has(add.column.toLowerCase())) continue;
    }
    try {
      await client.execute(statement);
    } catch (err) {
      if (add && isDuplicateColumn(err)) continue;
      throw err;
    }
  }
}

/**
 * Apply pending files in order. `_migrations` is written only after every
 * statement in that file succeeds, so a parse error leaves the file pending.
 */
/** Create the bookkeeping table and apply any pending files. */
export async function bootstrapSqliteSchema(
  client: MigrationClient,
  files: readonly { name: string; sql: string }[],
): Promise<void> {
  await client.execute(
    "create table if not exists _migrations (name text primary key, applied_at text not null default (datetime('now')))",
  );
  const doneRows = await client.execute("select name from _migrations");
  const done = doneRows.rows.map((row) => String(row.name));
  await applyPendingSqliteMigrations(client, files, done);
}

export async function applyPendingSqliteMigrations(
  client: MigrationClient,
  files: readonly { name: string; sql: string }[],
  applied: readonly string[],
): Promise<void> {
  const byName = new Map(files.map((file) => [file.name, file.sql]));
  for (const { name } of pendingMigrations(
    files.map((file) => file.name),
    applied,
  )) {
    const sql = byName.get(name);
    if (sql == null) throw new Error(`Missing migration ${name}`);
    if (isMediaRatingRebuild(sql)) await applyMediaRatingRebuild(client, sql);
    else await applySqliteMigration(client, sql);
    await client.execute({
      sql: "insert or ignore into _migrations (name) values (?)",
      args: [name],
    });
  }
}

const MEDIA_RATING_REBUILD = /create\s+table\s+if\s+not\s+exists\s+media_rating_new\b/i;

function isMediaRatingRebuild(sqlText: string): boolean {
  return MEDIA_RATING_REBUILD.test(sqlText) && sqlText.includes("'four_up'");
}

type RatingRow = {
  media_item_id: string;
  host: string;
  rating: string;
  updated_at: string;
};

/**
 * Rebuild media_rating so the CHECK allows four_up and three_up.
 *
 * LibSQL turns foreign keys on by default. PRAGMA foreign_keys is ignored
 * inside a transaction, and an execute() before the transaction uses another
 * connection, so this does not try to turn them off. Dropping media_rating
 * is allowed with foreign keys on: it is a child of media_item, and nothing
 * references it. The new table declares the same ON DELETE CASCADE, and the
 * rename keeps that action.
 *
 * The write transaction takes the lock before reading sqlite_master. A second
 * cold start waits, then sees the widened table and leaves the rows alone.
 * A busy lock is retried. Any other failure rolls back, so the next request
 * can try again. The bookkeeping insert stays outside this transaction, which
 * matches the other files: if the process dies after the commit, the retry
 * finds the widened check and does not copy again.
 */
async function applyMediaRatingRebuild(client: MigrationClient, sqlText: string): Promise<void> {
  if (!client.transaction) {
    throw new Error("The media rating rebuild needs one write transaction.");
  }
  const statements = sqlStatements(toSqlite(sqlText));
  if (statements.length === 0) throw new Error("The media rating rebuild is empty.");
  const transaction = client.transaction.bind(client);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let tx: MigrationTransaction | null = null;
    try {
      tx = await transaction("write");
      await rebuildMediaRating(tx, statements);
      await tx.commit();
      return;
    } catch (err) {
      if (tx) {
        try {
          await tx.rollback();
        } catch {
          // Already closed, or the commit landed and the connection moved on.
        }
      }
      if (!isBusyError(err) || attempt === 4) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
}

async function rebuildMediaRating(exec: MigrationTransaction, statements: readonly string[]): Promise<void> {
  const { live, next } = await ratingTables(exec);

  if (!live && next) {
    if (!widened(next)) {
      throw new Error("media_rating_new is missing four_up and media_rating is already gone.");
    }
    const before = await ratingRows(exec, "media_rating_new");
    await exec.execute("alter table media_rating_new rename to media_rating");
    const after = await ratingRows(exec, "media_rating");
    assertSameRows(before, after);
    await assertRatingTable(exec);
    return;
  }

  if (live && widened(live)) {
    const before = await ratingRows(exec, "media_rating");
    if (next) {
      await exec.execute(
        `insert or ignore into media_rating (media_item_id, host, rating, updated_at)
         select media_item_id, host, rating, updated_at from media_rating_new`,
      );
      await exec.execute("drop table media_rating_new");
      assertRowsKept(before, await ratingRows(exec, "media_rating"));
    } else {
      assertSameRows(before, await ratingRows(exec, "media_rating"));
    }
    await assertRatingTable(exec);
    return;
  }

  if (!live) throw new Error("media_rating is missing.");

  if (next && !widened(next)) await exec.execute("drop table media_rating_new");
  const before = await ratingRows(exec, "media_rating");
  for (const statement of statements) await exec.execute(statement);
  const after = await ratingRows(exec, "media_rating");
  assertSameRows(before, after);
  await assertRatingTable(exec);
}

async function ratingTables(
  exec: MigrationTransaction,
): Promise<{ live: string | null; next: string | null }> {
  const result = await exec.execute(
    "select name, sql from sqlite_master where type = 'table' and name in ('media_rating', 'media_rating_new')",
  );
  let live: string | null = null;
  let next: string | null = null;
  for (const row of result.rows) {
    const name = String(row.name ?? "");
    const sql = row.sql == null ? "" : String(row.sql);
    if (name === "media_rating") live = sql;
    if (name === "media_rating_new") next = sql;
  }
  return { live, next };
}

function widened(sql: string | null): boolean {
  return !!sql && sql.includes("'four_up'") && sql.includes("'three_up'");
}

async function ratingRows(exec: MigrationTransaction, table: "media_rating" | "media_rating_new"): Promise<RatingRow[]> {
  const result = await exec.execute(
    `select media_item_id, host, rating, updated_at from ${table} order by media_item_id, host`,
  );
  return result.rows.map((row) => ({
    media_item_id: String(row.media_item_id),
    host: String(row.host),
    rating: String(row.rating),
    updated_at: String(row.updated_at),
  }));
}

function sameRow(left: RatingRow, right: RatingRow): boolean {
  return (
    left.media_item_id === right.media_item_id &&
    left.host === right.host &&
    left.rating === right.rating &&
    left.updated_at === right.updated_at
  );
}

function assertSameRows(before: readonly RatingRow[], after: readonly RatingRow[]): void {
  if (before.length !== after.length || before.some((row, index) => !sameRow(row, after[index]!))) {
    throw new Error(`media_rating rebuild changed ${before.length} rows into ${after.length}.`);
  }
}

function assertRowsKept(before: readonly RatingRow[], after: readonly RatingRow[]): void {
  const afterKey = new Map(after.map((row) => [`${row.media_item_id}\t${row.host}`, row]));
  for (const row of before) {
    const kept = afterKey.get(`${row.media_item_id}\t${row.host}`);
    if (!kept || !sameRow(row, kept)) {
      throw new Error("media_rating rebuild changed an existing rating.");
    }
  }
}

async function assertRatingTable(exec: MigrationTransaction): Promise<void> {
  const { live, next } = await ratingTables(exec);
  if (next) throw new Error("media_rating_new was left behind.");
  if (!widened(live)) throw new Error("media_rating does not allow four_up and three_up.");
  if (!live || !/on delete cascade/i.test(live) || !/primary key/i.test(live)) {
    throw new Error("media_rating lost its primary key or its delete cascade.");
  }
  const check = await exec.execute("pragma foreign_key_check");
  if (check.rows.length > 0) throw new Error("media_rating foreign key check failed.");
}

function isBusyError(err: unknown): boolean {
  const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  return code === "SQLITE_BUSY" || /sqlite_busy|database is locked/i.test(message);
}

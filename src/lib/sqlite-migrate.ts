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
    await applySqliteMigration(client, sql);
    await client.execute({
      sql: "insert or ignore into _migrations (name) values (?)",
      args: [name],
    });
  }
}

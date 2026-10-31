import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { bindLibsql } from "./sql-bind";
import { bootstrapSqliteSchema } from "./sqlite-migrate";
import { pickTursoKeys } from "./turso-keys";

/** Which database backend is active. */
export type DbSource = "turso" | "neon" | "pglite";

export { pickTursoKeys } from "./turso-keys";

/**
 * Preview (`VERCEL_ENV=preview`) reads only `PREVIEW_TURSO_*`, so a preview
 * deploy cannot open the production database. Production ignores `PREVIEW_*`.
 * Local dev keeps the previous key preference. See `pickTursoKeys`.
 */
function findTurso(): { url: string; token: string } | null {
  if (typeof process === "undefined") return null;
  const picked = pickTursoKeys(process.env);
  if (!picked) return null;
  const url = process.env[picked.urlKey]?.trim();
  const token = process.env[picked.tokenKey]?.trim();
  if (!url || !token) return null;
  return { url, token };
}

export const tursoConfig = findTurso();

// An empty/whitespace DATABASE_URL (an easy misconfig in deploy UIs) must mean
// "unset" — otherwise production would silently run on the PGLite fallback.
const rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/**
 * Active backend: **Turso** when a marketplace `TURSO_DATABASE_URL` pair is set,
 * **Neon** when `DATABASE_URL` is set, otherwise embedded **PGLite**.
 */
export const dbSource: DbSource = tursoConfig ? "turso" : databaseUrl ? "neon" : "pglite";

/**
 * Minimal shared SQL surface, satisfied by both Neon and PGLite. Both the
 * tagged-template and `.query()` forms resolve to an array of row objects:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from todos where id = ${id}`; // parameterized
 *   const rows2 = await sql.query("select * from todos where id = $1", [id]);
 */
export type SqlStatement = { text: string; params?: unknown[] };

export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /**
   * Run statements in one write transaction. Turso uses a write batch so every
   * statement, including a clock read, runs on the primary instead of a
   * separate connection that can observe a different time.
   */
  batch(statements: readonly SqlStatement[]): Promise<unknown[][]>;
}

/**
 * Init state lives on globalThis as promises: dev HMR creates new instances of
 * this module, and two instances racing module-level state would open a second
 * pool or run two concurrent PGLite migration passes (whose duplicate
 * `_migrations` insert rejects — and would get memoized, poisoning every later
 * `getSql()`). A failed init clears its slot so the next call retries.
 */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

/**
 * Result-type parity: Postgres sends every value as text plus a type OID — the
 * JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
 * int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
 * JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
 * production return identical, JSON-safe shapes:
 *   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
 *                                   `::text` if you ever need huge integers)
 *   date                         -> 'YYYY-MM-DD' string
 *   interval                     -> Postgres interval text
 * numeric already comes back as a string on both (arbitrary precision).
 */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;
type Batch = (statements: readonly SqlStatement[]) => Promise<unknown[][]>;

/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run: Run, batch?: Batch): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    // Rebuild with $1, $2, … placeholders so values stay parameterized.
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  sql.batch =
    batch ??
    (async (statements) => {
      const out: unknown[][] = [];
      for (const statement of statements) {
        out.push(await run(statement.text, statement.params ?? []));
      }
      return out;
    });
  return sql;
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    // Regular Postgres driver: node-postgres (`pg`) — works directly with Neon's
    // pooled endpoint. One pool per process; warm serverless instances reuse it.
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({ connectionString: databaseUrl });
    return toSql(
      async <T>(text: string, params: unknown[]) => {
        const res = await pool.query(text, params);
        return res.rows as T[];
      },
      async (statements) => {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const out: unknown[][] = [];
          for (const statement of statements) {
            const res = await client.query(statement.text, statement.params ?? []);
            out.push(res.rows);
          }
          await client.query("commit");
          return out;
        } catch (err) {
          await client.query("rollback");
          throw err;
        } finally {
          client.release();
        }
      },
    );
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  // Embedded Postgres, imported on demand so it never loads on the Neon path.
  // One in-memory instance per process, shared across HMR module instances, so
  // data survives source edits (it resets on dev-server restart).
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  // Apply migrations/ (the single schema source) so preview matches production.
  // SQL is inlined by the bundler via import.meta.glob (no runtime fs); applied
  // files are tracked in _migrations. The glob does not descend, so the opt-in
  // auth schema under migrations/auth/ stays out. Runs once per module instance
  // — so an HMR reload after adding a migration file applies it live — with
  // passes serialized on a global chain so concurrent callers never
  // double-apply.
  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>("select name from _migrations");
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      // Apply + record atomically (parity with scripts/migrate.mjs) so a failed
      // statement can't leave a file half-applied but untracked.
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query(
          "insert into _migrations (name) values ($1) on conflict (name) do nothing",
          [name],
        );
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined) // an earlier failed pass must not wedge the chain
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(
    async <T>(text: string, params: unknown[]) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
    async (statements) => {
      const out: unknown[][] = [];
      await pg.transaction(async (tx) => {
        for (const statement of statements) {
          const result = await tx.query(statement.text, statement.params ?? []);
          out.push(result.rows);
        }
      });
      return out;
    },
  );
}

let sqlPromise: Promise<Sql> | null = null;

async function createTursoSql(): Promise<Sql> {
  if (!tursoConfig) throw new Error("Turso is not configured");
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: tursoConfig.url, authToken: tursoConfig.token });
  const migrations = import.meta.glob("/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  // `_migrations` is written only after a file's statements succeed.
  // A parse error leaves that file pending for the next boot.
  await bootstrapSqliteSchema(
    client,
    pendingMigrations(Object.keys(migrations), []).flatMap(({ name, path }) => {
      const sql = migrations[path];
      return sql == null ? [] : [{ name, sql }];
    }),
  );
  return toSql(
    async <T>(text: string, params: unknown[]) => {
      const bound = bindLibsql(text, params);
      const result = await client.execute({ sql: bound.sql, args: bound.args });
      return result.rows as unknown as T[];
    },
    async (statements) => {
      // "write" is BEGIN IMMEDIATE on the primary. A plain execute() would
      // open a fresh connection per statement, and a read can observe a clock
      // that disagrees with the connection that stored created_ms.
      const results = await client.batch(
        statements.map((statement) => {
          const bound = bindLibsql(statement.text, statement.params ?? []);
          return { sql: bound.sql, args: bound.args };
        }),
        "write",
      );
      return results.map((result) => result.rows as unknown[]);
    },
  );
}

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  return dbSource === "turso"
    ? createTursoSql()
    : dbSource === "neon"
      ? createNeonSql()
      : createPgliteSql();
}

/**
 * Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
 * otherwise the local PGLite fallback. Memoized — safe to call per request.
 *
 * Schema comes from `migrations/*.sql`, auto-applied before the first query on
 * both backends — define tables there, never inline in server functions.
 */
export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null; // don't memoize failures — let the next call retry
    throw err;
  });
  return sqlPromise;
}

/**
 * The shared PGLite instance (preview only), with `migrations/*.sql` applied.
 * Lets Better Auth persist to the SAME embedded DB as app data in preview (via a
 * Kysely dialect). Throws when `DATABASE_URL` is set (that path uses Neon).
 */
export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

function dbBackendLabel(source: DbSource): string {
  if (source === "turso") return "Turso";
  if (source === "neon") return "Neon";
  return "PGLite";
}

// Shared across HMR copies of this module so two instances don't each boot.
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};

/**
 * Finish DB bootstrap before the server handles traffic.
 *
 * - **Turso** and **PGLite**: open the database and apply `migrations/*.sql`.
 *   Concurrent callers share one promise. A connect or bootstrap failure is
 *   logged once with the real backend name (`Turso` or `PGLite`). The cached
 *   promise is dropped so the next call retries. Awaiters still receive the
 *   rejection. The eager import below does not rethrow it: nothing awaits
 *   that call, and a rethrow is an unhandled rejection that exits the
 *   serverless process (status 128).
 * - **Neon**: no-op (the pool is created on the first query).
 *
 * Vite `configureServer` awaits this at dev startup. Production imports of
 * this module start it immediately (see the bottom of the file).
 */
export function ensureDbReady(): Promise<void> {
  if (dbSource === "neon") return Promise.resolve();
  const existing = globalBoot.__pgBootstrapPromise__;
  if (existing) return existing;

  const boot = getSql().then(() => undefined);
  globalBoot.__pgBootstrapPromise__ = boot;
  // Attach the handler to `boot` itself. `.catch()` returns a new promise;
  // awaiting `boot` still rejects, and a `void ensureDbReady()` elsewhere
  // (the auth server) observes this same promise instead of a second,
  // unhandled one.
  void boot.catch((err: unknown) => {
    if (globalBoot.__pgBootstrapPromise__ === boot) {
      globalBoot.__pgBootstrapPromise__ = undefined;
    }
    console.error(`[db] ${dbBackendLabel(dbSource)} bootstrap failed:`, err);
  });
  return boot;
}

// Server-only eager start: open Turso or PGLite as soon as this module loads in
// Node. Client bundles never hit this path (`getSql` throws in the browser).
// The rejection is logged inside `ensureDbReady` and not rethrown — this call
// is not awaited, and a rethrow would be an unhandled rejection.
if (typeof window === "undefined" && dbSource !== "neon") {
  void ensureDbReady();
}

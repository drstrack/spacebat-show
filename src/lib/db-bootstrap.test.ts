import assert from "node:assert/strict";
import { registerHooks, type LoadHookSync, type ResolveHookSync } from "node:module";
import { describe, it } from "node:test";

/**
 * Node cannot evaluate Vite's `import.meta.glob`. Stub those two calls so a
 * retried connect can finish; the timeout itself happens on the first
 * `client.execute`, before migrations run.
 */
const MIGRATION_GLOB = /import\.meta\.glob\(\s*"\/migrations\/\*\.sql",\s*\{[^}]*\}\s*\)/g;

const LIBSQL_MOCK = `data:text/javascript,${encodeURIComponent(
  [
    "export function createClient() {",
    "  const fn = globalThis.__spacebatCreateClient;",
    "  if (typeof fn !== 'function') throw new Error('libsql mock not installed');",
    "  return fn();",
    "}",
  ].join("\n"),
)}`;

type MockClient = {
  execute: (statement?: unknown) => Promise<{ rows: unknown[] }>;
  batch: (statements?: unknown, mode?: unknown) => Promise<unknown[]>;
};

const globalMock = globalThis as typeof globalThis & {
  __spacebatCreateClient?: () => MockClient;
};

function sourceText(source: unknown): string | undefined {
  if (typeof source === "string") return source;
  if (source instanceof Uint8Array) return Buffer.from(source).toString("utf8");
  if (source instanceof ArrayBuffer) return Buffer.from(source).toString("utf8");
  return undefined;
}

const resolve: ResolveHookSync = (specifier, context, nextResolve) => {
  if (specifier === "@libsql/client") {
    return { url: LIBSQL_MOCK, shortCircuit: true };
  }
  // `db.ts` imports `./sql-bind` and `./turso-keys` without extensions.
  if (specifier.startsWith(".") && !/\.(?:[cm]?js|[cm]?ts|json)$/.test(specifier)) {
    try {
      return nextResolve(`${specifier}.ts`, context);
    } catch (err) {
      const missing =
        !!err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
      if (!missing) throw err;
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
};

const load: LoadHookSync = (url, context, nextLoad) => {
  const loaded = nextLoad(url, context);
  if (!url.endsWith("/src/lib/db.ts")) return loaded;
  const raw = sourceText(loaded.source);
  if (raw === undefined) return loaded;
  let stubs = 0;
  const source = raw.replace(MIGRATION_GLOB, () => {
    stubs += 1;
    return "({})";
  });
  if (stubs !== 2) {
    throw new Error(`expected to stub 2 import.meta.glob calls in db.ts, found ${stubs}`);
  }
  return { format: loaded.format ?? "module-typescript", source, shortCircuit: true };
};

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

describe("database bootstrap", () => {
  it("logs a Turso connect timeout once, stays up, and retries", async () => {
    const hooks = registerHooks({ resolve, load });
    const previous = {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
      VERCEL_ENV: process.env.VERCEL_ENV,
    };
    process.env.VERCEL_ENV = "production";
    process.env.TURSO_DATABASE_URL = "libsql://bootstrap-timeout.example";
    process.env.TURSO_AUTH_TOKEN = "test-token";

    const unhandled: unknown[] = [];
    const onUnhandled = (err: unknown) => {
      unhandled.push(err);
    };
    process.on("unhandledRejection", onUnhandled);

    const logged: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };

    let clients = 0;
    let timeout: TypeError | undefined;
    globalMock.__spacebatCreateClient = () => {
      clients += 1;
      const attempt = clients;
      return {
        async execute() {
          if (attempt === 1) {
            const cause = new Error("connect ETIMEDOUT 54.144.175.141:443") as Error & {
              code?: string;
            };
            cause.code = "ETIMEDOUT";
            timeout = new TypeError("fetch failed");
            timeout.cause = cause;
            throw timeout;
          }
          return { rows: [] };
        },
        async batch() {
          return [];
        },
      };
    };

    try {
      const db = await import("./db.ts");
      assert.equal(db.dbSource, "turso");
      assert.equal(db.tursoConfig?.url, "libsql://bootstrap-timeout.example");

      // The module already started the eager boot. A second floating call is
      // what the auth server does; it must share the handled promise.
      const first = db.ensureDbReady();
      void db.ensureDbReady();
      await assert.rejects(first, (err: unknown) => {
        assert.ok(err instanceof TypeError);
        assert.equal(err.message, "fetch failed");
        const cause = err.cause as { code?: string; message?: string } | undefined;
        assert.equal(cause?.code, "ETIMEDOUT");
        assert.match(cause?.message ?? "", /54\.144\.175\.141/);
        return true;
      });
      await settle();

      assert.equal(unhandled.length, 0);
      assert.equal(logged.length, 1);
      assert.equal(logged[0]?.[0], "[db] Turso bootstrap failed:");
      assert.equal(logged[0]?.[1], timeout);
      assert.equal(clients, 1);

      const sql = await db.getSql();
      assert.deepEqual(await sql.query("select 1 as ok"), []);
      assert.equal(await db.getSql(), sql);
      await db.ensureDbReady();
      await settle();

      assert.equal(clients, 2);
      assert.equal(db.dbSource, "turso");
      assert.equal(unhandled.length, 0);
      assert.equal(logged.length, 1);
    } finally {
      console.error = originalError;
      process.off("unhandledRejection", onUnhandled);
      delete globalMock.__spacebatCreateClient;
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      hooks.deregister();
    }
  });
});

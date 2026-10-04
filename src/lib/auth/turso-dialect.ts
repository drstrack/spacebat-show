/**
 * Kysely dialect so Better Auth talks to the same Turso database as app data.
 * The client is opened only after migrations have run.
 */
import type { Client } from "@libsql/client";
import {
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from "kysely";
import { getSql, tursoConfig } from "../db";

export function tursoDialect(): Dialect {
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new TursoDriver(),
    createQueryCompiler: () => new SqliteQueryCompiler(),
    createIntrospector: (db) => new SqliteIntrospector(db),
  };
}

class TursoDriver implements Driver {
  private client: Client | undefined;
  private connection: TursoConnection | undefined;
  private queue: Array<(connection: TursoConnection) => void> = [];

  async init(): Promise<void> {
    this.client = await openTurso();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    this.client ??= await openTurso();
    if (this.connection) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.connection = new TursoConnection(this.client);
    return this.connection;
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection !== this.connection) throw new Error("Invalid connection");
    const next = this.queue.shift();
    if (!next) {
      this.connection = undefined;
      return;
    }
    next(this.connection);
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await (connection as TursoConnection).executeQuery(CompiledQuery.raw("begin"));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await (connection as TursoConnection).executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await (connection as TursoConnection).executeQuery(CompiledQuery.raw("rollback"));
  }

  async destroy(): Promise<void> {
    this.client = undefined;
    this.connection = undefined;
    this.queue = [];
  }
}

async function openTurso(): Promise<Client> {
  if (!tursoConfig) throw new Error("Turso is not configured");
  await getSql();
  const { createClient } = await import("@libsql/client");
  return createClient({ url: tursoConfig.url, authToken: tursoConfig.token });
}

class TursoConnection implements DatabaseConnection {
  constructor(private readonly client: Client) {}

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const result = await this.client.execute({
      sql: compiledQuery.sql,
      args: compiledQuery.parameters.map((value) => {
        if (value === undefined || value === null) return null;
        if (typeof value === "boolean") return value ? 1 : 0;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") return value;
        return String(value);
      }),
    });
    return {
      rows: result.rows as unknown as O[],
      numAffectedRows: BigInt(result.rowsAffected),
    };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    const result = await this.executeQuery<O>(compiledQuery);
    const rows = result.rows;
    for (let i = 0; i < rows.length; i += chunkSize) {
      yield { rows: rows.slice(i, i + chunkSize) };
    }
  }
}

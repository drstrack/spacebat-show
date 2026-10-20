/**
 * Postgres `$n` can be repeated. libSQL counts each `?`, so a reused `$1`
 * must be sent again for every occurrence. `$10` stays one placeholder.
 */
export function bindLibsql(
  text: string,
  params: readonly unknown[] = [],
): { sql: string; args: Array<null | number | string | bigint> } {
  const args: Array<null | number | string | bigint> = [];
  const sql = text.replace(/\$(\d+)/g, (_match, digits: string) => {
    const index = Number(digits) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= params.length) {
      throw new Error(`SQL placeholder $${digits} is out of range`);
    }
    args.push(libsqlArg(params[index]));
    return "?";
  });
  return { sql, args };
}

function libsqlArg(value: unknown): null | number | string | bigint {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1n : 0n;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("SQL arguments must be finite numbers");
    }
    // Hrana sends a JS number as a float. A bigint is a 64-bit integer, which
    // matches `created_ms bigint` instead of making Turso compare a REAL.
    if (Number.isSafeInteger(value)) return BigInt(value);
    return value;
  }
  if (typeof value === "string") return value;
  return String(value);
}

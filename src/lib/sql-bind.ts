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
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") {
    return value;
  }
  return String(value);
}

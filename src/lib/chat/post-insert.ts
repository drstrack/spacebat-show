import { POST_WINDOW_MAX, retryAfterMs } from "./limits.ts";

export type RateRow = { created_ms: unknown; now_ms: unknown };

export type RateDecision = {
  nowMs: number;
  lastMs: number | null;
  times: number[];
  waitMs: number | null;
};

/**
 * Newest text-message times for one sender, plus one database clock reading.
 * The gap is decided from these values in JavaScript. Comparing `Date.now()`
 * on one Vercel isolate with a `created_ms` written by another isolate made a
 * 4s pause look shorter than 3s (posts at 0s and 12s landed; 4s and 8s did not).
 * The database clock is the same for every isolate. `unixepoch('subsec')` and
 * `clock_timestamp()` are both millisecond resolution.
 */
export function rateSnapshotSql(dialect: "sqlite" | "postgres"): string {
  const nowMs =
    dialect === "sqlite"
      ? "cast(unixepoch('subsec') * 1000 as integer)"
      : "(extract(epoch from clock_timestamp()) * 1000)::bigint";
  return `
    select m.created_ms as created_ms, clock.now_ms as now_ms
    from (select ${nowMs} as now_ms) clock
    left join chat_message m
      on m.user_id = $1 and m.room = $2 and m.kind = 'text'
    order by m.created_ms desc
    limit ${POST_WINDOW_MAX}
  `;
}

export function rateDecision(rows: readonly RateRow[], nowFallback = Date.now()): RateDecision {
  const nowMs = asMs(rows[0]?.now_ms) || nowFallback;
  const times = rows.map((row) => asMs(row.created_ms)).filter((value) => value > 0);
  const lastMs = times.length > 0 ? Math.max(...times) : null;
  return { nowMs, lastMs, times, waitMs: retryAfterMs(lastMs, times, nowMs) };
}

/**
 * Insert only when the sender's newest text time is still `lastMs` (null when
 * they have never posted). The 3s gap is not re-checked here — `rateDecision`
 * already did, on the database clock — so a float `>` comparison cannot stretch
 * it. Two overlapping requests still cannot both pass: the second sees a new max.
 *
 * $1 room, $2 user id, $3 body, $4 created_ms, $5 last created_ms.
 * $1, $2, and $5 are repeated. libSQL expands each occurrence in `bindLibsql`.
 */
/** SQLite integer is 64-bit. Postgres `integer` is 32-bit and cannot hold epoch ms. */
export function postInsertSql(dialect: "sqlite" | "postgres"): string {
  const last = dialect === "sqlite" ? "cast($5 as integer)" : "cast($5 as bigint)";
  return `
insert into chat_message (room, user_id, kind, body, created_ms)
select $1, $2, 'text', $3, $4
where (
  ${last} is null
  and not exists (
    select 1 from chat_message
    where user_id = $2 and room = $1 and kind = 'text'
  )
) or (
  select max(created_ms) from chat_message
  where user_id = $2 and room = $1 and kind = 'text'
) = ${last}
returning id, created_ms
`;
}

export const POST_INSERT_SQL = postInsertSql("sqlite");

export const PLAIN_INSERT_SQL = `
insert into chat_message (room, user_id, kind, body, created_ms)
values ($1, $2, 'text', $3, $4)
returning id, created_ms
`;

export function postInsertParams(
  room: string,
  userId: string,
  body: string,
  createdMs: number,
  lastMs: number | null,
): [string, string, string, number, number | null] {
  return [room, userId, body, createdMs, lastMs];
}

function asMs(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

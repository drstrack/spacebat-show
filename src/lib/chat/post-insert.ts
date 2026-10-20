import { POST_GAP_MS, POST_WINDOW_MAX, POST_WINDOW_MS, retryAfterMs } from "./limits.ts";

export type RateRow = { created_ms: unknown; now_ms: unknown };

export type RateDecision = {
  nowMs: number;
  lastMs: number | null;
  times: number[];
  waitMs: number | null;
};

/**
 * Database clock for a chat post. `unixepoch('subsec')` is fractional seconds
 * on libSQL; multiplied by 1000 it matches epoch milliseconds. If that call
 * is missing, fall back to whole seconds so a post still gets a database time
 * instead of this isolate's `Date.now()`.
 */
export function dbNowSql(dialect: "sqlite" | "postgres"): string {
  if (dialect === "postgres") return "(extract(epoch from clock_timestamp()) * 1000)::bigint";
  return "cast(coalesce(unixepoch('subsec'), cast(strftime('%s','now') as integer)) * 1000 as integer)";
}

/**
 * Newest text-message times for one sender, plus one database clock reading.
 * Used to explain a refusal. The insert below is what allows or refuses.
 */
export function rateSnapshotSql(dialect: "sqlite" | "postgres"): string {
  return `
    select m.created_ms as created_ms, clock.now_ms as now_ms
    from (select ${dbNowSql(dialect)} as now_ms) clock
    left join chat_message m
      on m.user_id = $1 and m.room = $2 and m.kind = 'text'
    order by m.created_ms desc
    limit ${POST_WINDOW_MAX}
  `;
}

/**
 * `nowMs` is 0 when the clock column did not come back. Callers must not
 * substitute `Date.now()` — that isolate clock is what made a 4s pause look
 * shorter than 3s.
 */
export function rateDecision(rows: readonly RateRow[]): RateDecision {
  const nowMs = asMs(rows[0]?.now_ms);
  const times = rows.map((row) => asMs(row.created_ms)).filter((value) => value > 0);
  const lastMs = times.length > 0 ? Math.max(...times) : null;
  return {
    nowMs,
    lastMs,
    times,
    waitMs: nowMs > 0 ? retryAfterMs(lastMs, times, nowMs) : null,
  };
}

/**
 * Insert a text message only when this statement's own database clock is at
 * least 3s after the sender's newest text row, and fewer than 20 of their
 * newest 20 text rows fall inside the last minute.
 *
 * The clock value stored in `created_ms` is the same value the gap is compared
 * against. A refused attempt inserts nothing, so it does not move that newest
 * time. Pass `nowExpr` only from tests that need a fake clock (`$4`).
 *
 * $1 room, $2 user id, $3 body. Those placeholders repeat; libSQL expands each
 * occurrence in `bindLibsql`.
 */
export function postAttemptSql(
  dialect: "sqlite" | "postgres",
  nowExpr = dbNowSql(dialect),
): string {
  return `
insert into chat_message (room, user_id, kind, body, created_ms)
select $1, $2, 'text', $3, clock.now_ms
from (select ${nowExpr} as now_ms) clock
where (
  not exists (
    select 1 from chat_message
    where user_id = $2 and room = $1 and kind = 'text'
  )
  or (
    clock.now_ms - (
      select max(created_ms) from chat_message
      where user_id = $2 and room = $1 and kind = 'text'
    ) >= ${POST_GAP_MS}
    and (
      select count(*) from (
        select created_ms from chat_message
        where user_id = $2 and room = $1 and kind = 'text'
        order by created_ms desc
        limit ${POST_WINDOW_MAX}
      ) recent
      where clock.now_ms >= recent.created_ms
        and clock.now_ms - recent.created_ms < ${POST_WINDOW_MS}
    ) < ${POST_WINDOW_MAX}
  )
)
returning id, created_ms
`;
}

function asMs(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

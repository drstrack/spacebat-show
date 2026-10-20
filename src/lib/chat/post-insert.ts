import { POST_GAP_MS, POST_WINDOW_MAX, POST_WINDOW_MS } from "./limits.ts";

/**
 * One statement so the 3s gap and the per-minute cap use the same timestamp
 * that is stored. A previous text message newer than `createdMs - 3000` blocks
 * the insert; a gap of exactly 3000ms is allowed (`>` not `>=`).
 *
 * $1 room, $2 user id, $3 body, $4 created_ms, $5 gap floor, $6 window floor, $7 max.
 * $1 and $2 are repeated. Postgres allows that. libSQL does not, so the Turso
 * path expands each occurrence in `bindLibsql`.
 */
export const POST_INSERT_SQL = `
insert into chat_message (room, user_id, kind, body, created_ms)
select $1, $2, 'text', $3, $4
where not exists (
  select 1 from chat_message
  where user_id = $2 and room = $1 and kind = 'text'
    and created_ms > $5
)
and (
  select count(*) from chat_message
  where user_id = $2 and room = $1 and kind = 'text'
    and created_ms > $6
) < $7
returning id
`;

export function postInsertParams(
  room: string,
  userId: string,
  body: string,
  createdMs: number,
): [string, string, string, number, number, number, number] {
  return [
    room,
    userId,
    body,
    createdMs,
    createdMs - POST_GAP_MS,
    createdMs - POST_WINDOW_MS,
    POST_WINDOW_MAX,
  ];
}

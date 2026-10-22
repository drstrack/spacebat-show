/**
 * Join and leave announcements.
 *
 * The room already polls for messages. Each open room also heartbeats. A
 * second tab, a refresh, or a short blip only moves `last_seen_ms`. The leave
 * line is posted once that heartbeat has been missing for two minutes, which
 * is long enough that closing the tab (the heartbeat stops) still announces
 * it, and short enough that a reload does not. Coming back within three
 * minutes of the last heartbeat does not post another join.
 */

/** Client heartbeat interval. Stays under the leave timeout, including a background tab. */
export const PRESENCE_HEARTBEAT_MS = 20_000;

/** No heartbeat for this long, and the room says they left. */
export const PRESENCE_LEAVE_MS = 120_000;

/**
 * A return within this long of the last heartbeat does not post a new join.
 * Longer than the leave timeout, so a short absence is one leave and no join.
 */
export const PRESENCE_REJOIN_MS = 3 * 60_000;

const ROOM = "main";

export type PresenceSnapshot = {
  lastSeenMs: number;
  state: "here" | "gone";
  sessionMs: number | null;
  leftMs: number | null;
};

export type BeatPlan =
  | { type: "refresh" }
  | { type: "resume"; sessionMs: number }
  | { type: "insert-join"; sessionMs: number }
  | { type: "leave"; sessionMs: number; nextSessionMs: number; then: "resume" | "join" };

type PresenceSql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

type PresenceRow = {
  last_seen_ms: number | string | bigint;
  state: string;
  session_ms: number | string | bigint | null;
  left_ms: number | string | bigint | null;
};

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function presenceBody(handle: string, action: "join" | "leave"): string {
  const name = handle.trim().replace(/\s+/g, " ") || "Someone";
  return action === "join" ? `${name} joined the chat` : `${name} left the chat`;
}

export function presenceEventKey(
  action: "join" | "leave",
  userId: string,
  sessionMs: number,
): string {
  return `presence:${action}:${userId}:${sessionMs}`;
}

export function planBeat(row: PresenceSnapshot | null, now: number): BeatPlan {
  if (row?.state === "here" && now - row.lastSeenMs < PRESENCE_LEAVE_MS) {
    return { type: "refresh" };
  }
  if (row?.state === "here" && row.sessionMs != null && now - row.lastSeenMs >= PRESENCE_LEAVE_MS) {
    return {
      type: "leave",
      sessionMs: row.sessionMs,
      nextSessionMs: now,
      then: now - row.lastSeenMs < PRESENCE_REJOIN_MS ? "resume" : "join",
    };
  }
  if (row && now - row.lastSeenMs < PRESENCE_REJOIN_MS) {
    return { type: "resume", sessionMs: now };
  }
  return { type: "insert-join", sessionMs: now };
}

function snapshot(row: PresenceRow): PresenceSnapshot {
  return {
    lastSeenMs: num(row.last_seen_ms),
    state: row.state === "gone" ? "gone" : "here",
    sessionMs: row.session_ms == null ? null : num(row.session_ms),
    leftMs: row.left_ms == null ? null : num(row.left_ms),
  };
}

async function readPresence(sql: PresenceSql, userId: string): Promise<PresenceSnapshot | null> {
  const rows = await sql<PresenceRow>`
    select last_seen_ms, state, session_ms, left_ms
    from chat_presence
    where user_id = ${userId} and room = ${ROOM}
  `;
  return rows[0] ? snapshot(rows[0]) : null;
}

async function refreshPresence(sql: PresenceSql, userId: string, now: number): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`
    update chat_presence
    set last_seen_ms = ${now}
    where user_id = ${userId}
      and room = ${ROOM}
      and state = 'here'
      and last_seen_ms > ${now - PRESENCE_LEAVE_MS}
    returning user_id
  `;
  return rows.length > 0;
}

/**
 * The message row is written only after the presence update wins, so two
 * tabs cannot both announce. `user_id` stays null: this is not a member post.
 * Turso is SQLite and cannot put the insert in the same statement as the
 * update, so a follow-up repair posts a leave if the process died in between.
 */
async function insertAnnouncement(
  sql: PresenceSql,
  userId: string,
  handle: string,
  action: "join" | "leave",
  sessionMs: number,
  createdMs: number,
): Promise<void> {
  const body = presenceBody(handle, action);
  const eventKey = presenceEventKey(action, userId, sessionMs);
  await sql`
    insert into chat_message (room, user_id, kind, body, created_ms, event_key)
    values (${ROOM}, null, 'presence', ${body}, ${createdMs}, ${eventKey})
    on conflict (event_key) do nothing
  `;
}

async function claimJoin(
  sql: PresenceSql,
  userId: string,
  handle: string,
  sessionMs: number,
  now: number,
): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`
    insert into chat_presence (user_id, room, last_seen_ms, state, session_ms, left_ms)
    values (${userId}, ${ROOM}, ${now}, 'here', ${sessionMs}, null)
    on conflict (user_id) do update set
      last_seen_ms = excluded.last_seen_ms,
      state = 'here',
      session_ms = excluded.session_ms,
      left_ms = excluded.left_ms
    where chat_presence.state = 'gone'
      and chat_presence.last_seen_ms <= ${now - PRESENCE_REJOIN_MS}
    returning user_id
  `;
  if (rows.length === 0) return false;
  await insertAnnouncement(sql, userId, handle, "join", sessionMs, now);
  return true;
}

async function claimLeave(
  sql: PresenceSql,
  userId: string,
  handle: string,
  sessionMs: number,
  now: number,
): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`
    update chat_presence
    set state = 'gone', left_ms = ${now}
    where user_id = ${userId}
      and room = ${ROOM}
      and state = 'here'
      and session_ms = ${sessionMs}
      and last_seen_ms <= ${now - PRESENCE_LEAVE_MS}
    returning user_id
  `;
  if (rows.length === 0) return false;
  await insertAnnouncement(sql, userId, handle, "leave", sessionMs, now);
  return true;
}

async function resumePresence(
  sql: PresenceSql,
  userId: string,
  sessionMs: number,
  now: number,
  previousSessionMs: number | null,
): Promise<boolean> {
  const rows =
    previousSessionMs == null
      ? await sql<{ user_id: string }>`
          update chat_presence
          set last_seen_ms = ${now}, state = 'here', session_ms = ${sessionMs}
          where user_id = ${userId}
            and room = ${ROOM}
            and state = 'gone'
            and last_seen_ms > ${now - PRESENCE_REJOIN_MS}
          returning user_id
        `
      : await sql<{ user_id: string }>`
          update chat_presence
          set last_seen_ms = ${now}, state = 'here', session_ms = ${sessionMs}
          where user_id = ${userId}
            and room = ${ROOM}
            and state = 'gone'
            and session_ms = ${previousSessionMs}
          returning user_id
        `;
  return rows.length > 0;
}

async function beat(sql: PresenceSql, userId: string, handle: string, now: number): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await readPresence(sql, userId);
    const plan = planBeat(row, now);
    if (plan.type === "refresh") {
      if (await refreshPresence(sql, userId, now)) return;
      continue;
    }
    if (plan.type === "resume") {
      if (await resumePresence(sql, userId, plan.sessionMs, now, null)) return;
      continue;
    }
    if (plan.type === "insert-join") {
      if (!(await claimJoin(sql, userId, handle, plan.sessionMs, now))) continue;
      return;
    }
    if (!(await claimLeave(sql, userId, handle, plan.sessionMs, now))) continue;
    if (plan.then === "join") {
      await claimJoin(sql, userId, handle, plan.nextSessionMs, now);
    } else {
      await resumePresence(sql, userId, plan.nextSessionMs, now, plan.sessionMs);
    }
    return;
  }
}

type StaleRow = {
  user_id: string;
  session_ms: number | string | bigint | null;
  handle: string | null;
};

async function repairLeaves(sql: PresenceSql): Promise<void> {
  const rows = await sql<{
    user_id: string;
    session_ms: number | string | bigint;
    left_ms: number | string | bigint;
    handle: string | null;
  }>`
    select p.user_id, p.session_ms, p.left_ms, c.handle
    from chat_presence p
    left join chat_member c on c.user_id = p.user_id
    where p.room = ${ROOM}
      and p.state = 'gone'
      and p.session_ms is not null
      and p.left_ms is not null
      and not exists (
        select 1 from chat_message m
        where m.event_key = 'presence:leave:' || p.user_id || ':' || cast(p.session_ms as text)
      )
  `;
  for (const row of rows) {
    await insertAnnouncement(
      sql,
      row.user_id,
      row.handle?.trim() || "Someone",
      "leave",
      num(row.session_ms),
      num(row.left_ms),
    );
  }
}

async function sweepLeaves(sql: PresenceSql, now: number): Promise<void> {
  const rows = await sql<StaleRow>`
    select p.user_id, p.session_ms, c.handle
    from chat_presence p
    left join chat_member c on c.user_id = p.user_id
    where p.room = ${ROOM}
      and p.state = 'here'
      and p.session_ms is not null
      and p.last_seen_ms <= ${now - PRESENCE_LEAVE_MS}
  `;
  for (const row of rows) {
    if (row.session_ms == null) continue;
    const sessionMs = num(row.session_ms);
    await claimLeave(sql, row.user_id, row.handle?.trim() || "Someone", sessionMs, now);
  }
}

/**
 * One presence pass for a member who is in the room right now. Sweeps everyone
 * whose heartbeat has already timed out, then records this member.
 */
export async function touchPresence(
  sql: PresenceSql,
  userId: string,
  handle: string,
  now = Date.now(),
): Promise<void> {
  await sweepLeaves(sql, now);
  await repairLeaves(sql);
  await beat(sql, userId, handle, now);
}

/**
 * Tab close. Refreshes a member who is still inside the leave window so the
 * timeout starts at the close, and posts leaves that are already due. It does
 * not announce a join: closing the tab is not coming back.
 */
export async function pulsePresence(
  sql: PresenceSql,
  userId: string,
  now = Date.now(),
): Promise<void> {
  await sweepLeaves(sql, now);
  await repairLeaves(sql);
  await refreshPresence(sql, userId, now);
}

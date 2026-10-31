/**
 * Who is in the room.
 *
 * The room already polls for messages. Each open room also heartbeats. A
 * second tab, a refresh, or a short blip only moves `last_seen_ms`. After two
 * minutes without a heartbeat they drop off the Online list. Coming back
 * within three minutes keeps the same visit. None of this writes a chat
 * message.
 */

/** Client heartbeat interval. Stays under the leave timeout, including a background tab. */
export const PRESENCE_HEARTBEAT_MS = 20_000;

/** No heartbeat for this long, and they are no longer online. */
export const PRESENCE_LEAVE_MS = 120_000;

/**
 * A return within this long of the last heartbeat stays the same visit.
 * Longer than the leave timeout, so a short absence does not start a new one.
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

async function claimJoin(
  sql: PresenceSql,
  userId: string,
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
  return rows.length > 0;
}

async function claimLeave(
  sql: PresenceSql,
  userId: string,
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
  return rows.length > 0;
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

async function beat(sql: PresenceSql, userId: string, now: number): Promise<void> {
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
      if (!(await claimJoin(sql, userId, plan.sessionMs, now))) continue;
      return;
    }
    if (!(await claimLeave(sql, userId, plan.sessionMs, now))) continue;
    if (plan.then === "join") {
      await claimJoin(sql, userId, plan.nextSessionMs, now);
    } else {
      await resumePresence(sql, userId, plan.nextSessionMs, now, plan.sessionMs);
    }
    return;
  }
}

type StaleRow = {
  user_id: string;
  session_ms: number | string | bigint | null;
};

async function sweepLeaves(sql: PresenceSql, now: number): Promise<void> {
  const rows = await sql<StaleRow>`
    select p.user_id, p.session_ms
    from chat_presence p
    where p.room = ${ROOM}
      and p.state = 'here'
      and p.session_ms is not null
      and p.last_seen_ms <= ${now - PRESENCE_LEAVE_MS}
  `;
  for (const row of rows) {
    if (row.session_ms == null) continue;
    await claimLeave(sql, row.user_id, num(row.session_ms), now);
  }
}

/**
 * One presence pass for a member who is in the room right now. Sweeps everyone
 * whose heartbeat has already timed out, then records this member.
 */
export async function touchPresence(
  sql: PresenceSql,
  userId: string,
  now = Date.now(),
): Promise<void> {
  await sweepLeaves(sql, now);
  await beat(sql, userId, now);
}

/**
 * Tab close. Refreshes a member who is still inside the leave window so the
 * timeout starts at the close, and marks visits that are already over. It
 * does not start a new visit: closing the tab is not coming back.
 */
export async function pulsePresence(
  sql: PresenceSql,
  userId: string,
  now = Date.now(),
): Promise<void> {
  await sweepLeaves(sql, now);
  await refreshPresence(sql, userId, now);
}

export type OnlineMember = {
  handle: string;
  imageUrl: string | null;
  you: boolean;
};

const HTTP_IMAGE = /^https?:\/\//i;

/**
 * Members still inside the leave window. A heartbeat older than that means
 * they have left, so they are not listed.
 * The row carries a room name and an https avatar when the account has one.
 */
export async function listOnline(
  sql: PresenceSql,
  viewerId: string,
  now: number,
): Promise<OnlineMember[]> {
  const rows = await sql<{
    handle: string;
    image_url: string | null;
    user_id: string;
  }>`
    select c.handle, u.image as image_url, p.user_id
    from chat_presence p
    join chat_member c on c.user_id = p.user_id
    left join "user" u on u.id = p.user_id
    where p.room = ${ROOM}
      and p.state = 'here'
      and p.last_seen_ms > ${now - PRESENCE_LEAVE_MS}
      and c.banned_ms is null
  `;
  const members: OnlineMember[] = [];
  for (const row of rows) {
    const handle = row.handle.trim().replace(/\s+/g, " ");
    if (!handle) continue;
    const image = typeof row.image_url === "string" ? row.image_url.trim() : "";
    members.push({
      handle,
      imageUrl: HTTP_IMAGE.test(image) ? image : null,
      you: row.user_id === viewerId,
    });
  }
  members.sort((a, b) => a.handle.localeCompare(b.handle, "en", { sensitivity: "base" }));
  return members;
}

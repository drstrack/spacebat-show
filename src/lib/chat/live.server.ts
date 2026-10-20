import { show } from "@/data/show";
import { getSql, type Sql } from "@/lib/db";
import {
  CHECK_GAP_MS,
  decideLive,
  ENDED_BODY,
  LIVE_BODY,
  MIN_LIVE_MS,
  probeIcecast,
  shouldPostLiveAlert,
  type LiveProbe,
  type LiveState,
} from "@/lib/chat/live";
import { readFeed } from "@/lib/podcast-feed.functions";
import type { ChatLive } from "@/lib/chat/types";

const ROOM = "main";
const MANUAL_LIVE_MS = 4 * 60 * 60 * 1000;
const MANUAL_OFF_MS = 15 * 60 * 1000;

const QUIET: ChatLive = { isLive: false, sinceMs: null, source: null };

type LiveRow = {
  is_live: number | string | bigint;
  since_ms: number | string | bigint | null;
  source: string | null;
  manual: string | null;
  manual_until_ms: number | string | bigint | null;
  off_checks: number | string | bigint;
  last_alert_ms: number | string | bigint | null;
};

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code) : "";
  const message = "message" in err ? String(err.message) : "";
  return code === "23505" || /unique|SQLITE_CONSTRAINT/i.test(message);
}

function streamUrl(): string {
  const override = process.env.CHAT_LIVE_STREAM_URL?.trim();
  return override || show.liveStream;
}

function toState(row: LiveRow | undefined): LiveState {
  if (!row) {
    return {
      isLive: false,
      sinceMs: null,
      source: null,
      manual: null,
      manualUntilMs: null,
      offChecks: 0,
      lastAlertMs: null,
    };
  }
  return {
    isLive: num(row.is_live) === 1,
    sinceMs: row.since_ms == null ? null : num(row.since_ms),
    source: row.source,
    manual: row.manual,
    manualUntilMs: row.manual_until_ms == null ? null : num(row.manual_until_ms),
    offChecks: num(row.off_checks),
    lastAlertMs: row.last_alert_ms == null ? null : num(row.last_alert_ms),
  };
}

function toPublic(state: LiveState): ChatLive {
  const source =
    state.source === "stream" || state.source === "feed" || state.source === "manual"
      ? state.source
      : null;
  return { isLive: state.isLive, sinceMs: state.sinceMs, source };
}

async function probeFeed(): Promise<LiveProbe> {
  try {
    const feed = await readFeed();
    if (!feed) return "unknown";
    return feed.live ? "on" : "off";
  } catch {
    return "unknown";
  }
}

async function ensureRow(sql: Sql, room: string): Promise<void> {
  await sql`
    insert into chat_live_state (room)
    values (${room})
    on conflict (room) do nothing
  `;
}

async function loadRow(sql: Sql, room: string): Promise<LiveRow | undefined> {
  const rows = await sql<LiveRow>`
    select is_live, since_ms, source, manual, manual_until_ms, off_checks, last_alert_ms
    from chat_live_state
    where room = ${room}
  `;
  return rows[0];
}

async function saveState(
  sql: Sql,
  room: string,
  state: LiveState,
  checkedMs: number,
): Promise<void> {
  await sql`
    update chat_live_state
    set
      is_live = ${state.isLive ? 1 : 0},
      since_ms = ${state.sinceMs},
      source = ${state.source},
      manual = ${state.manual},
      manual_until_ms = ${state.manualUntilMs},
      off_checks = ${state.offChecks},
      last_alert_ms = ${state.lastAlertMs},
      checked_ms = ${checkedMs}
    where room = ${room}
  `;
}

async function insertSystem(sql: Sql, room: string, body: string, eventKey: string, now: number) {
  try {
    await sql`
      insert into chat_message (room, user_id, kind, body, created_ms, event_key)
      values (${room}, null, 'system', ${body}, ${now}, ${eventKey})
    `;
  } catch (err) {
    if (isUniqueViolation(err)) return;
    throw err;
  }
}

async function postTransition(
  sql: Sql,
  room: string,
  previous: LiveState,
  next: LiveState,
  transition: "went-live" | "went-off" | null,
  now: number,
): Promise<LiveState> {
  if (transition === "went-live" && shouldPostLiveAlert(previous.lastAlertMs, now)) {
    const since = next.sinceMs ?? now;
    await insertSystem(sql, room, LIVE_BODY, `live:${since}`, now);
    return { ...next, lastAlertMs: now };
  }
  if (
    transition === "went-off" &&
    previous.sinceMs != null &&
    now - previous.sinceMs >= MIN_LIVE_MS
  ) {
    await insertSystem(sql, room, ENDED_BODY, `ended:${previous.sinceMs}`, now);
  }
  return next;
}

async function requireCrew(sql: Sql, userId: string): Promise<void> {
  const rows = await sql<{ role: string }>`
    select role from member_profile where user_id = ${userId}
  `;
  if (rows[0]?.role !== "admin") throw new Error("Crew only.");
}

/**
 * One Icecast probe and one feed read every 30 seconds, shared by every open
 * chat. A lost claim returns the stored state and does not probe.
 */
export async function refreshLive(room = ROOM): Promise<ChatLive> {
  try {
    const sql = await getSql();
    const now = Date.now();
    await ensureRow(sql, room);
    const claimed = await sql<LiveRow>`
      update chat_live_state
      set checked_ms = ${now}
      where room = ${room} and checked_ms < ${now - CHECK_GAP_MS}
      returning is_live, since_ms, source, manual, manual_until_ms, off_checks, last_alert_ms
    `;
    if (!claimed[0]) return toPublic(toState(await loadRow(sql, room)));

    const previous = toState(claimed[0]);
    const [icecast, feed] = await Promise.all([probeIcecast(streamUrl()), probeFeed()]);
    console.log(`[live] probe icecast=${icecast} feed=${feed}`);
    const decision = decideLive(previous, icecast, feed, now);
    const next = await postTransition(
      sql,
      room,
      previous,
      decision.state,
      decision.transition,
      now,
    );
    await saveState(sql, room, next, now);
    return toPublic(next);
  } catch {
    try {
      const sql = await getSql();
      return toPublic(toState(await loadRow(sql, room)));
    } catch {
      return QUIET;
    }
  }
}

export async function adminSetLive(
  userId: string,
  mode: "live" | "off" | "auto",
): Promise<ChatLive> {
  const sql = await getSql();
  await requireCrew(sql, userId);
  const now = Date.now();
  await ensureRow(sql, ROOM);
  const previous = toState(await loadRow(sql, ROOM));
  let next: LiveState = previous;
  let checkedMs = now;

  if (mode === "live") {
    const sinceMs = previous.isLive && previous.sinceMs != null ? previous.sinceMs : now;
    next = {
      ...previous,
      isLive: true,
      sinceMs,
      source: "manual",
      manual: "live",
      manualUntilMs: now + MANUAL_LIVE_MS,
      offChecks: 0,
    };
    if (shouldPostLiveAlert(previous.lastAlertMs, now)) {
      await insertSystem(sql, ROOM, LIVE_BODY, `live:${sinceMs}`, now);
      next = { ...next, lastAlertMs: now };
    }
  } else if (mode === "off") {
    next = {
      ...previous,
      isLive: false,
      source: "manual",
      manual: "off",
      manualUntilMs: now + MANUAL_OFF_MS,
      offChecks: 0,
    };
  } else {
    next = { ...previous, manual: null, manualUntilMs: null, source: null };
    checkedMs = 0;
  }

  await saveState(sql, ROOM, next, checkedMs);
  await sql`
    insert into chat_audit (actor_id, action, target_user_id, message_id, detail, created_ms)
    values (${userId}, 'live', null, null, ${mode}, ${now})
  `;
  return toPublic(next);
}

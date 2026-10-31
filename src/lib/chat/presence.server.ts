import { getSql, type Sql } from "@/lib/db";
import { CHAT_RULES_VERSION } from "@/lib/chat/rules";
import { pulsePresence, touchPresence } from "@/lib/chat/presence";

const ROOM = "main";

export type PresenceAnnouncement = {
  id: number;
  body: string;
  createdMs: number;
};

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadActiveMember(sql: Sql, userId: string): Promise<{ handle: string } | null> {
  const rows = await sql<{
    handle: string;
    rules_version: number | string | bigint;
    rules_accepted_ms: number | string | bigint | null;
    banned_ms: number | string | bigint | null;
  }>`
    select handle, rules_version, rules_accepted_ms, banned_ms
    from chat_member
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  if (num(row.rules_version) < CHAT_RULES_VERSION || row.rules_accepted_ms == null) return null;
  if (row.banned_ms != null) return null;
  const handle = row.handle.trim();
  if (!handle) return null;
  return { handle };
}

/** Heartbeat for the signed-in member. No-op until they have accepted the rules. */
export async function touchPresenceFor(userId: string, now = Date.now()): Promise<void> {
  const sql = await getSql();
  const member = await loadActiveMember(sql, userId);
  if (!member) return;
  await touchPresence(sql, userId, now);
}

/** Last signal from a tab that is going away. Does not post a join. */
export async function pulsePresenceFor(userId: string, now = Date.now()): Promise<void> {
  const sql = await getSql();
  const member = await loadActiveMember(sql, userId);
  if (!member) return;
  await pulsePresence(sql, userId, now);
}

export async function listPresenceAnnouncements(actorId: string): Promise<PresenceAnnouncement[]> {
  const sql = await getSql();
  const role = await sql<{ role: string }>`
    select role from member_profile where user_id = ${actorId}
  `;
  if (role[0]?.role !== "admin") throw new Error("Crew only.");
  const rows = await sql<{
    id: number | string | bigint;
    body: string;
    created_ms: number | string | bigint;
  }>`
    select id, body, created_ms
    from chat_message
    where room = ${ROOM} and kind = 'presence' and deleted_ms is null
    order by id desc
    limit 40
  `;
  return rows.map((row) => ({
    id: num(row.id),
    body: row.body,
    createdMs: num(row.created_ms),
  }));
}

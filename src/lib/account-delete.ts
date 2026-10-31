import type { Sql, SqlStatement } from "@/lib/db";

/** Shown on chat posts after the author is removed. */
export const DELETED_ACCOUNT_LABEL = "Account deleted";

export type ConfirmGesture = "confirm" | "cancel" | "escape" | "outside";

/**
 * Cancel, Escape, and a click outside the dialog do not delete.
 * Only the explicit confirm gesture does.
 */
export async function applyConfirmedRemoval<T>(
  gesture: ConfirmGesture,
  remove: () => Promise<T>,
): Promise<T | null> {
  if (gesture !== "confirm") return null;
  return remove();
}

/** Name shown in the confirmation dialog. Prefers "Name (email)". */
export function accountLabel(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const cleanName = name?.trim() ?? "";
  const cleanEmail = email?.trim() ?? "";
  if (cleanName && cleanEmail && cleanName.toLowerCase() !== cleanEmail.toLowerCase()) {
    return `${cleanName} (${cleanEmail})`;
  }
  return cleanName || cleanEmail || "this account";
}

/**
 * Author label for a chat row. A text post whose user id was cleared reads
 * "Account deleted". A missing handle on a still-present user stays "Listener".
 */
export function chatAuthorLabel(input: {
  kind: string;
  userId: string | null;
  handle: string | null | undefined;
}): string {
  const handle = input.handle?.trim() ?? "";
  if (handle) return handle;
  if (input.kind === "presence") return "";
  if (input.kind === "system") return "SpaceBat";
  if (!input.userId) return DELETED_ACCOUNT_LABEL;
  return "Listener";
}

/** Matches `presenceBody` so join/leave lines stay in the room's voice. */
export function deletedPresenceLine(action: "join" | "leave"): string {
  return action === "join"
    ? `${DELETED_ACCOUNT_LABEL} joined the chat`
    : `${DELETED_ACCOUNT_LABEL} left the chat`;
}

function countOf(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function adminCount(sql: Sql): Promise<number> {
  const rows = await sql<{ n: unknown }>`
    select count(*) as n from member_profile where role = 'admin'
  `;
  return countOf(rows[0]?.n);
}

async function assertKeepsLastAdmin(sql: Sql, role: string | null | undefined): Promise<void> {
  if (role !== "admin") return;
  const count = await adminCount(sql);
  if (count <= 1) throw new Error("The last admin stays.");
}

/**
 * Drop the auth rows and profile, and anonymize chat so other people's
 * history stays. Posted messages keep their text and attachments. The author
 * id is cleared so the room labels them "Account deleted". Unsent uploads
 * (no message yet) are removed. Join/leave lines that name this person are
 * rewritten. Sessions and credential rows are deleted explicitly; profile and
 * chat membership also cascade from the user row.
 */
export async function purgeAccount(
  sql: Sql,
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  const joinPrefix = `presence:join:${userId}:`;
  const leavePrefix = `presence:leave:${userId}:`;
  const statements: SqlStatement[] = [
    {
      text: `update chat_message set user_id = null where user_id = $1`,
      params: [userId],
    },
    {
      text: `update chat_message set body = $1
        where kind = 'presence' and substr(event_key, 1, length($2)) = $2`,
      params: [deletedPresenceLine("join"), joinPrefix],
    },
    {
      text: `update chat_message set body = $1
        where kind = 'presence' and substr(event_key, 1, length($2)) = $2`,
      params: [deletedPresenceLine("leave"), leavePrefix],
    },
    {
      text: `delete from chat_upload where user_id = $1 and message_id is null`,
      params: [userId],
    },
    {
      text: `delete from chat_presence where user_id = $1`,
      params: [userId],
    },
  ];
  const cleanEmail = email?.trim() ?? "";
  if (cleanEmail) {
    statements.push({
      text: `delete from "verification" where lower(identifier) = lower($1)`,
      params: [cleanEmail],
    });
  }
  statements.push(
    { text: `delete from "session" where "userId" = $1`, params: [userId] },
    { text: `delete from "account" where "userId" = $1`, params: [userId] },
    { text: `delete from chat_member where user_id = $1`, params: [userId] },
    { text: `delete from member_profile where user_id = $1`, params: [userId] },
    { text: `delete from "user" where id = $1`, params: [userId] },
  );
  await sql.batch(statements);
}

/**
 * Promote or demote a member. The actor must be an admin. A locked show
 * account stays admin, an admin cannot demote themselves, and the last
 * remaining admin cannot be demoted.
 */
export async function changeMemberRole(
  sql: Sql,
  input: {
    actorId: string;
    targetId: string;
    role: "admin" | "listener";
    lockedEmails: ReadonlySet<string>;
  },
): Promise<void> {
  if (!input.actorId) throw new Error("Unauthorized");
  const actors = await sql<{ role: string }>`
    select role from member_profile where user_id = ${input.actorId}
  `;
  if (actors[0]?.role !== "admin") throw new Error("Crew only.");
  if (!input.targetId) throw new Error("Missing account.");
  if (input.role !== "admin" && input.role !== "listener") {
    throw new Error("Pick admin or listener.");
  }

  const rows = await sql<{ email: string; role: string }>`
    select u.email, m.role
    from member_profile m
    join "user" u on u.id = m.user_id
    where m.user_id = ${input.targetId}
  `;
  const target = rows[0];
  if (!target) throw new Error("No such account.");
  const locked = input.lockedEmails.has((target.email ?? "").toLowerCase());
  if (locked && input.role !== "admin") throw new Error("The show account stays admin.");
  if (input.targetId === input.actorId && input.role !== "admin") {
    throw new Error("You can’t remove your own admin access.");
  }
  if (input.role === "listener" && target.role === "admin") {
    await assertKeepsLastAdmin(sql, target.role);
  }
  const updated = new Date().toISOString();
  await sql`
    update member_profile set role = ${input.role}, updated_at = ${updated}
    where user_id = ${input.targetId}
  `;
}

/**
 * Admin removal. The actor comes from the session. Refuses the actor's own
 * row, a locked show account, and the last remaining admin.
 */
export async function removeMemberAccount(
  sql: Sql,
  input: { actorId: string; targetId: string; lockedEmails: ReadonlySet<string> },
): Promise<void> {
  if (!input.actorId) throw new Error("Unauthorized");
  const actors = await sql<{ role: string }>`
    select role from member_profile where user_id = ${input.actorId}
  `;
  if (actors[0]?.role !== "admin") throw new Error("Crew only.");
  if (!input.targetId) throw new Error("Missing account.");
  if (input.targetId === input.actorId) throw new Error("That account stays.");

  const rows = await sql<{ email: string; role: string }>`
    select u.email, m.role
    from member_profile m
    join "user" u on u.id = m.user_id
    where m.user_id = ${input.targetId}
  `;
  const target = rows[0];
  if (!target) throw new Error("No such account.");
  if (input.lockedEmails.has((target.email ?? "").toLowerCase())) {
    throw new Error("That account stays.");
  }
  await assertKeepsLastAdmin(sql, target.role);
  await purgeAccount(sql, input.targetId, target.email);
}

/**
 * Self-service deletion. `sessionUserId` is the verified session user.
 * There is no target id argument, so this cannot delete anyone else.
 * The last remaining admin is refused.
 */
export async function deleteOwnAccount(
  sql: Sql,
  sessionUserId: string | null | undefined,
): Promise<void> {
  if (!sessionUserId) throw new Error("Unauthorized");
  const rows = await sql<{ email: string; role: string | null }>`
    select u.email, m.role
    from "user" u
    left join member_profile m on m.user_id = u.id
    where u.id = ${sessionUserId}
  `;
  const target = rows[0];
  if (!target) throw new Error("No such account.");
  await assertKeepsLastAdmin(sql, target.role);
  await purgeAccount(sql, sessionUserId, target.email);
}

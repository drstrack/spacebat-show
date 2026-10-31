import { chatAuthorLabel } from "@/lib/account-delete";
import { getSql, type Sql } from "@/lib/db";
import { DEFAULT_BLOCKWORDS, normalizeBlockword } from "@/lib/chat/blockwords";
import {
  AUTO_HIDE_REPORT_COUNT,
  canSanction,
  compileReport,
  MUTE_1H_MINUTES,
  PURGE_WINDOW_MS,
  REPORT_WINDOW_MS,
  REPORTS_PER_HOUR,
  shouldAutoHide,
  type ResolveAction,
} from "@/lib/chat/moderation";
import { CHAT_RULES_VERSION } from "@/lib/chat/rules";
import { deleteUploadsForMessages } from "@/lib/chat/uploads.server";

const ROOM = "main";
const AUTO_HIDE_ACTOR = "auto-report";
const REPORT_BAN_REASON = "Removed after reports";

export type ReportGroup = {
  messageId: number;
  handle: string;
  body: string;
  count: number;
  reasons: string[];
  firstReportMs: number;
  hidden: boolean;
};

export type SanctionedMember = {
  userId: string;
  handle: string;
  email: string;
  mutedUntilMs: number | null;
  bannedMs: number | null;
  banReason: string | null;
};

export type AuditEntry = {
  id: number;
  action: string;
  actorHandle: string;
  actorEmail: string;
  targetHandle: string | null;
  targetEmail: string | null;
  messageId: number | null;
  detail: string | null;
  createdMs: number;
};

export type BlockwordEntry = {
  word: string;
  source: "default" | "room";
  createdMs: number | null;
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

async function roleIsAdmin(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ role: string }>`
    select role from member_profile where user_id = ${userId}
  `;
  return rows[0]?.role === "admin";
}

async function requireAdmin(sql: Sql, userId: string): Promise<void> {
  if (!(await roleIsAdmin(sql, userId))) throw new Error("Crew only.");
}

async function requireMember(sql: Sql, userId: string): Promise<void> {
  const rows = await sql<{
    rules_version: number | string | bigint;
    rules_accepted_ms: number | string | bigint | null;
    banned_ms: number | string | bigint | null;
  }>`
    select rules_version, rules_accepted_ms, banned_ms
    from chat_member
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || num(row.rules_version) < CHAT_RULES_VERSION || row.rules_accepted_ms == null) {
    throw new Error("Accept the room rules first.");
  }
  if (row.banned_ms != null) throw new Error("You can't post in the room.");
}

async function audit(
  sql: Sql,
  row: {
    actorId: string;
    action: string;
    targetUserId?: string | null;
    messageId?: number | null;
    detail?: string | null;
    createdMs: number;
  },
): Promise<void> {
  await sql`
    insert into chat_audit (actor_id, action, target_user_id, message_id, detail, created_ms)
    values (
      ${row.actorId},
      ${row.action},
      ${row.targetUserId ?? null},
      ${row.messageId ?? null},
      ${row.detail ?? null},
      ${row.createdMs}
    )
  `;
}

async function requireListenerTarget(sql: Sql, actorId: string, targetId: string): Promise<void> {
  const targetIsAdmin = await roleIsAdmin(sql, targetId);
  const decision = canSanction(
    { userId: actorId, isAdmin: true },
    { userId: targetId, isAdmin: targetIsAdmin },
  );
  if (!decision.ok) throw new Error(decision.error);
  const rows = await sql<{ user_id: string }>`
    select user_id from chat_member where user_id = ${targetId}
  `;
  if (!rows[0]) throw new Error("That listener isn't in the room.");
}

type MessageRef = {
  id: number | string | bigint;
  user_id: string | null;
  kind: string;
  deleted_ms: number | string | bigint | null;
};

async function loadMessage(sql: Sql, id: number): Promise<MessageRef | null> {
  const rows = await sql<MessageRef>`
    select id, user_id, kind, deleted_ms
    from chat_message
    where id = ${id} and room = ${ROOM}
  `;
  return rows[0] ?? null;
}

async function softDelete(sql: Sql, id: number, actorId: string, now: number): Promise<void> {
  await sql`
    update chat_message
    set deleted_ms = ${now}, deleted_by = ${actorId}
    where id = ${id} and room = ${ROOM} and deleted_ms is null
  `;
}

async function muteUntil(sql: Sql, targetId: string, untilMs: number): Promise<void> {
  await sql`
    update chat_member set muted_until_ms = ${untilMs} where user_id = ${targetId}
  `;
}

async function banMember(sql: Sql, targetId: string, reason: string, now: number): Promise<void> {
  await sql`
    update chat_member
    set banned_ms = ${now}, ban_reason = ${reason}
    where user_id = ${targetId}
  `;
}

async function closeReports(
  sql: Sql,
  messageId: number,
  actorId: string,
  action: string,
  now: number,
): Promise<void> {
  await sql`
    update chat_report
    set resolved_ms = ${now}, resolved_by = ${actorId}, resolution = ${action}
    where message_id = ${messageId} and resolved_ms is null
  `;
}

export async function activeBlockwords(sql: Sql): Promise<string[]> {
  const rows = await sql<{ word: string }>`select word from chat_blockword`;
  return [...DEFAULT_BLOCKWORDS, ...rows.map((row) => row.word)];
}

export async function adminDeleteMessage(
  actorId: string,
  input: { id: number; reason?: string },
): Promise<{ id: number; deleted: true }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const message = await loadMessage(sql, input.id);
  if (!message) throw new Error("That message is gone.");
  const now = Date.now();
  if (message.deleted_ms == null) await softDelete(sql, input.id, actorId, now);
  await deleteUploadsForMessages(sql, [input.id]);
  await audit(sql, {
    actorId,
    action: "delete",
    targetUserId: message.user_id,
    messageId: input.id,
    detail: input.reason?.trim() || null,
    createdMs: now,
  });
  return { id: input.id, deleted: true };
}

export async function adminMute(
  actorId: string,
  input: { userId: string; minutes: 60 | 1440 },
): Promise<{ userId: string; mutedUntilMs: number }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  await requireListenerTarget(sql, actorId, input.userId);
  const now = Date.now();
  const mutedUntilMs = now + input.minutes * 60 * 1000;
  await muteUntil(sql, input.userId, mutedUntilMs);
  await audit(sql, {
    actorId,
    action: "mute",
    targetUserId: input.userId,
    detail: `${input.minutes}m`,
    createdMs: now,
  });
  return { userId: input.userId, mutedUntilMs };
}

export async function adminUnmute(
  actorId: string,
  input: { userId: string },
): Promise<{ ok: true }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const now = Date.now();
  await sql`update chat_member set muted_until_ms = null where user_id = ${input.userId}`;
  await audit(sql, {
    actorId,
    action: "unmute",
    targetUserId: input.userId,
    createdMs: now,
  });
  return { ok: true };
}

export async function adminBan(
  actorId: string,
  input: { userId: string; reason: string; purge?: boolean },
): Promise<{ userId: string; purged: number }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  await requireListenerTarget(sql, actorId, input.userId);
  const reason = input.reason.trim();
  if (!reason || reason.length > 200) throw new Error("Say why.");
  const now = Date.now();
  await banMember(sql, input.userId, reason, now);
  await audit(sql, {
    actorId,
    action: "ban",
    targetUserId: input.userId,
    detail: reason,
    createdMs: now,
  });
  let purged = 0;
  if (input.purge) {
    const rows = await sql<{ id: number | string | bigint }>`
      update chat_message
      set deleted_ms = ${now}, deleted_by = ${actorId}
      where user_id = ${input.userId}
        and room = ${ROOM}
        and kind = 'text'
        and deleted_ms is null
        and created_ms > ${now - PURGE_WINDOW_MS}
      returning id
    `;
    purged = rows.length;
    await deleteUploadsForMessages(
      sql,
      rows.map((row) => num(row.id)),
    );
    await audit(sql, {
      actorId,
      action: "purge",
      targetUserId: input.userId,
      detail: String(purged),
      createdMs: now,
    });
  }
  return { userId: input.userId, purged };
}

export async function adminUnban(
  actorId: string,
  input: { userId: string },
): Promise<{ ok: true }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const now = Date.now();
  await sql`
    update chat_member
    set banned_ms = null, ban_reason = null
    where user_id = ${input.userId}
  `;
  await audit(sql, {
    actorId,
    action: "unban",
    targetUserId: input.userId,
    createdMs: now,
  });
  return { ok: true };
}

export async function reportMessage(
  reporterId: string,
  input: { messageId: number; reason: string; note: string },
): Promise<{ ok: true; hidden: boolean }> {
  const compiled = compileReport(input.reason, input.note);
  if (!compiled.ok) throw new Error(compiled.error);
  const sql = await getSql();
  await requireMember(sql, reporterId);
  const message = await loadMessage(sql, input.messageId);
  if (!message) throw new Error("That message is gone.");
  if (message.kind !== "text") throw new Error("You can't report that.");
  if (message.user_id === reporterId) throw new Error("You can't report your own message.");

  const existing = await sql<{ id: number | string | bigint }>`
    select id from chat_report
    where message_id = ${input.messageId} and reporter_id = ${reporterId}
  `;
  if (existing.length > 0) throw new Error("You already reported that.");

  const now = Date.now();
  const recent = await sql<{ n: number | string | bigint }>`
    select count(*) as n from chat_report
    where reporter_id = ${reporterId} and created_ms > ${now - REPORT_WINDOW_MS}
  `;
  if (num(recent[0]?.n) >= REPORTS_PER_HOUR)
    throw new Error("You've reported enough for this hour.");

  try {
    await sql`
      insert into chat_report (message_id, reporter_id, reason, created_ms)
      values (${input.messageId}, ${reporterId}, ${compiled.stored}, ${now})
    `;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("You already reported that.");
    throw err;
  }

  const counts = await sql<{ n: number | string | bigint }>`
    select count(distinct reporter_id) as n from chat_report where message_id = ${input.messageId}
  `;
  const distinct = num(counts[0]?.n);
  let hidden = message.deleted_ms != null;
  if (shouldAutoHide(distinct) && message.deleted_ms == null) {
    await softDelete(sql, input.messageId, AUTO_HIDE_ACTOR, now);
    await deleteUploadsForMessages(sql, [input.messageId]);
    await audit(sql, {
      actorId: reporterId,
      action: "auto-hide",
      targetUserId: message.user_id,
      messageId: input.messageId,
      detail: `${AUTO_HIDE_REPORT_COUNT} reports`,
      createdMs: now,
    });
    hidden = true;
  }
  return { ok: true, hidden };
}

type ReportRow = {
  message_id: number | string | bigint;
  reason: string;
  created_ms: number | string | bigint;
  body: string | null;
  deleted_ms: number | string | bigint | null;
  user_id: string | null;
  kind: string | null;
  handle: string | null;
};

export async function listReports(actorId: string): Promise<ReportGroup[]> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const rows = await sql<ReportRow>`
    select r.message_id, r.reason, r.created_ms, m.body, m.deleted_ms, m.user_id, m.kind, c.handle
    from chat_report r
    join chat_message m on m.id = r.message_id
    left join chat_member c on c.user_id = m.user_id
    where r.resolved_ms is null
    order by r.created_ms asc
  `;
  const groups = new Map<number, ReportGroup>();
  for (const row of rows) {
    const messageId = num(row.message_id);
    const existing = groups.get(messageId);
    if (!existing) {
      groups.set(messageId, {
        messageId,
        handle: chatAuthorLabel({
          kind: row.kind ?? "text",
          userId: row.user_id,
          handle: row.handle,
        }),
        body: row.body ?? "",
        count: 1,
        reasons: [row.reason],
        firstReportMs: num(row.created_ms),
        hidden: row.deleted_ms != null,
      });
      continue;
    }
    existing.count += 1;
    if (!existing.reasons.includes(row.reason)) existing.reasons.push(row.reason);
  }
  return [...groups.values()];
}

export async function resolveReport(
  actorId: string,
  input: { messageId: number; action: ResolveAction },
): Promise<{ ok: true }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const message = await loadMessage(sql, input.messageId);
  if (!message) throw new Error("That message is gone.");
  const open = await sql<{ n: number | string | bigint }>`
    select count(*) as n from chat_report
    where message_id = ${input.messageId} and resolved_ms is null
  `;
  const openCount = num(open[0]?.n);
  if (openCount === 0 && input.action !== "restore")
    throw new Error("That report is already closed.");

  const now = Date.now();
  const targetId = message.user_id;
  if ((input.action === "delete-and-mute" || input.action === "delete-and-ban") && targetId) {
    await requireListenerTarget(sql, actorId, targetId);
  }

  if (
    input.action === "delete" ||
    input.action === "delete-and-mute" ||
    input.action === "delete-and-ban"
  ) {
    if (message.deleted_ms == null) await softDelete(sql, input.messageId, actorId, now);
    await deleteUploadsForMessages(sql, [input.messageId]);
    await audit(sql, {
      actorId,
      action: "delete",
      targetUserId: targetId,
      messageId: input.messageId,
      detail: input.action,
      createdMs: now,
    });
  }

  if (input.action === "delete-and-mute" && targetId) {
    const until = now + MUTE_1H_MINUTES * 60 * 1000;
    await muteUntil(sql, targetId, until);
    await audit(sql, {
      actorId,
      action: "mute",
      targetUserId: targetId,
      messageId: input.messageId,
      detail: `${MUTE_1H_MINUTES}m`,
      createdMs: now,
    });
  }

  if (input.action === "delete-and-ban" && targetId) {
    await banMember(sql, targetId, REPORT_BAN_REASON, now);
    await audit(sql, {
      actorId,
      action: "ban",
      targetUserId: targetId,
      messageId: input.messageId,
      detail: REPORT_BAN_REASON,
      createdMs: now,
    });
  }

  if (input.action === "restore") {
    await sql`
      update chat_message
      set deleted_ms = null, deleted_by = null
      where id = ${input.messageId} and room = ${ROOM}
    `;
    await audit(sql, {
      actorId,
      action: "restore",
      targetUserId: targetId,
      messageId: input.messageId,
      createdMs: now,
    });
  }

  if (input.action === "dismiss") {
    await audit(sql, {
      actorId,
      action: "dismiss",
      targetUserId: targetId,
      messageId: input.messageId,
      createdMs: now,
    });
  }

  if (openCount > 0) await closeReports(sql, input.messageId, actorId, input.action, now);
  return { ok: true };
}

type AuditRow = {
  id: number | string | bigint;
  action: string;
  message_id: number | string | bigint | null;
  detail: string | null;
  created_ms: number | string | bigint;
  actor_handle: string | null;
  actor_email: string | null;
  target_handle: string | null;
  target_email: string | null;
};

export async function listAudit(
  actorId: string,
  input: { before?: number },
): Promise<AuditEntry[]> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const rows =
    input.before == null
      ? await sql<AuditRow>`
          select
            a.id, a.action, a.message_id, a.detail, a.created_ms,
            actor.handle as actor_handle, actor_user.email as actor_email,
            target.handle as target_handle, target_user.email as target_email
          from chat_audit a
          left join chat_member actor on actor.user_id = a.actor_id
          left join "user" actor_user on actor_user.id = a.actor_id
          left join chat_member target on target.user_id = a.target_user_id
          left join "user" target_user on target_user.id = a.target_user_id
          order by a.id desc
          limit 100
        `
      : await sql<AuditRow>`
          select
            a.id, a.action, a.message_id, a.detail, a.created_ms,
            actor.handle as actor_handle, actor_user.email as actor_email,
            target.handle as target_handle, target_user.email as target_email
          from chat_audit a
          left join chat_member actor on actor.user_id = a.actor_id
          left join "user" actor_user on actor_user.id = a.actor_id
          left join chat_member target on target.user_id = a.target_user_id
          left join "user" target_user on target_user.id = a.target_user_id
          where a.id < ${input.before}
          order by a.id desc
          limit 100
        `;
  return rows.map((row) => ({
    id: num(row.id),
    action: row.action,
    actorHandle: row.actor_handle?.trim() || "Listener",
    actorEmail: row.actor_email ?? "",
    targetHandle: row.target_handle?.trim() || null,
    targetEmail: row.target_email ?? "",
    messageId: row.message_id == null ? null : num(row.message_id),
    detail: row.detail,
    createdMs: num(row.created_ms),
  }));
}

type SanctionRow = {
  user_id: string;
  handle: string;
  email: string | null;
  muted_until_ms: number | string | bigint | null;
  banned_ms: number | string | bigint | null;
  ban_reason: string | null;
};

export async function listSanctions(actorId: string): Promise<SanctionedMember[]> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const now = Date.now();
  const rows = await sql<SanctionRow>`
    select c.user_id, c.handle, u.email, c.muted_until_ms, c.banned_ms, c.ban_reason
    from chat_member c
    left join "user" u on u.id = c.user_id
    where c.banned_ms is not null
      or (c.muted_until_ms is not null and c.muted_until_ms > ${now})
    order by c.handle asc
  `;
  return rows.map((row) => ({
    userId: row.user_id,
    handle: row.handle,
    email: row.email ?? "",
    mutedUntilMs:
      row.muted_until_ms != null && num(row.muted_until_ms) > now ? num(row.muted_until_ms) : null,
    bannedMs: row.banned_ms == null ? null : num(row.banned_ms),
    banReason: row.ban_reason,
  }));
}

export async function listBlockwords(actorId: string): Promise<BlockwordEntry[]> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const rows = await sql<{ word: string; created_ms: number | string | bigint }>`
    select word, created_ms from chat_blockword order by word asc
  `;
  const room = rows.map((row) => ({
    word: row.word,
    source: "room" as const,
    createdMs: num(row.created_ms),
  }));
  const defaults = DEFAULT_BLOCKWORDS.map((word) => ({
    word,
    source: "default" as const,
    createdMs: null,
  }));
  return [...defaults, ...room];
}

export async function adminAddBlockword(
  actorId: string,
  input: { word: string },
): Promise<{ word: string }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const word = normalizeBlockword(input.word);
  if (!word) throw new Error("Use a single word, 2–32 letters or numbers.");
  if (DEFAULT_BLOCKWORDS.includes(word as (typeof DEFAULT_BLOCKWORDS)[number])) {
    throw new Error("That word is already blocked.");
  }
  const now = Date.now();
  try {
    await sql`
      insert into chat_blockword (word, added_by, created_ms)
      values (${word}, ${actorId}, ${now})
    `;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("That word is already blocked.");
    throw err;
  }
  await audit(sql, {
    actorId,
    action: "blockword-add",
    detail: word,
    createdMs: now,
  });
  return { word };
}

export async function adminRemoveBlockword(
  actorId: string,
  input: { word: string },
): Promise<{ ok: true }> {
  const sql = await getSql();
  await requireAdmin(sql, actorId);
  const word = normalizeBlockword(input.word);
  if (!word) throw new Error("Use a single word, 2–32 letters or numbers.");
  if (DEFAULT_BLOCKWORDS.includes(word as (typeof DEFAULT_BLOCKWORDS)[number])) {
    throw new Error("That word is part of the built-in list.");
  }
  const now = Date.now();
  const removed = await sql<{ word: string }>`
    delete from chat_blockword where word = ${word} returning word
  `;
  if (removed.length === 0) throw new Error("That word is not on the list.");
  await audit(sql, {
    actorId,
    action: "blockword-remove",
    detail: word,
    createdMs: now,
  });
  return { ok: true };
}

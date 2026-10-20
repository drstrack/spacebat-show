import { dbSource, getSql, type Sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { containsBlockedWord } from "@/lib/chat/blockwords";
import { gifSearchEnabled } from "@/lib/chat/gifs.server";
import { normalizeBody, rateDebug, slowDownMessage, validateHandle } from "@/lib/chat/limits";
import {
  postAttemptSql,
  rateDecision,
  rateSnapshotSql,
  type RateDecision,
  type RateRow,
} from "@/lib/chat/post-insert";
import { refreshLive } from "@/lib/chat/live.server";
import { CHAT_NEW_MEMBER_LINK_DELAY_MIN, countUrls, MAX_URLS_PER_MESSAGE } from "@/lib/chat/render";
import { activeBlockwords } from "@/lib/chat/moderation.server";
import { CHAT_RULES_VERSION } from "@/lib/chat/rules";
import type {
  ChatList,
  ChatListItem,
  ChatLive,
  ChatMe,
  ChatMember,
  ChatMessage,
} from "@/lib/chat/types";

const ROOM = "main";
const NEXT_POLL_MS = 4_000;
const LATEST_LIMIT = 50;
const AFTER_LIMIT = 100;
const BEFORE_LIMIT = 50;

type MemberRow = {
  handle: string;
  rules_version: number | string | bigint;
  rules_accepted_ms: number | string | bigint | null;
  muted_until_ms: number | string | bigint | null;
  banned_ms: number | string | bigint | null;
  created_ms: number | string | bigint | null;
};

type MessageRow = {
  id: number | string | bigint;
  user_id: string | null;
  kind: string;
  body: string | null;
  created_ms: number | string | bigint;
  deleted_ms: number | string | bigint | null;
  handle: string | null;
  mine: number | string | bigint | boolean;
};

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rulesAccepted(row: MemberRow): boolean {
  return num(row.rules_version) >= CHAT_RULES_VERSION && row.rules_accepted_ms != null;
}

function isBanned(row: MemberRow): boolean {
  return row.banned_ms != null;
}

function isMuted(row: MemberRow, now: number): boolean {
  return row.muted_until_ms != null && num(row.muted_until_ms) > now;
}

function toMember(row: MemberRow, now = Date.now()): ChatMember {
  const muted = isMuted(row, now);
  return {
    handle: row.handle,
    rulesAccepted: rulesAccepted(row),
    muted,
    mutedUntilMs: muted ? num(row.muted_until_ms) : null,
    banned: isBanned(row),
  };
}

function adminEmails(): Set<string> {
  const extra = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(["spacebatshow@gmail.com", ...extra]);
}

/**
 * Crew check matches `loadAnalytics` (`member_profile.role = 'admin'`).
 * The session address is only a fallback for a listener who has not opened
 * Account yet, and it is never returned.
 */
async function callerIsAdmin(sql: Sql, userId: string): Promise<boolean> {
  const [rows, session] = await Promise.all([
    sql<{ role: string }>`select role from member_profile where user_id = ${userId}`,
    getSessionUser(),
  ]);
  if (rows[0]?.role === "admin") return true;
  const address = session?.id === userId ? session.email?.trim().toLowerCase() : "";
  return Boolean(address && adminEmails().has(address));
}

async function loadMember(sql: Sql, userId: string): Promise<MemberRow | null> {
  const rows = await sql<MemberRow>`
    select handle, rules_version, rules_accepted_ms, muted_until_ms, banned_ms, created_ms
    from chat_member
    where user_id = ${userId}
  `;
  return rows[0] ?? null;
}

async function requireReader(sql: Sql, userId: string): Promise<MemberRow> {
  const row = await loadMember(sql, userId);
  if (!row || !rulesAccepted(row)) throw new Error("Accept the room rules first.");
  if (isBanned(row)) throw new Error("You can't post in the room.");
  return row;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code) : "";
  const message = "message" in err ? String(err.message) : "";
  return code === "23505" || /unique|SQLITE_CONSTRAINT/i.test(message);
}

function toListItem(row: MessageRow, isAdmin: boolean): ChatListItem {
  const id = num(row.id);
  if (row.deleted_ms != null) return { id, deleted: true };
  const kind = row.kind === "system" ? "system" : "text";
  const message: ChatMessage = {
    id,
    handle: row.handle?.trim() || (kind === "system" ? "SpaceBat" : "Listener"),
    body: row.body ?? "",
    createdMs: num(row.created_ms),
    kind,
    mine: row.mine === true || num(row.mine) === 1,
  };
  if (isAdmin && row.user_id) message.authorId = row.user_id;
  return message;
}

const MESSAGE_SELECT = `
  select
    m.id,
    m.user_id,
    m.kind,
    case when m.deleted_ms is null then m.body else null end as body,
    m.created_ms,
    m.deleted_ms,
    c.handle,
    case when m.user_id = $1 then 1 else 0 end as mine
  from chat_message m
  left join chat_member c on c.user_id = m.user_id
`;

export async function getChatMe(userId: string): Promise<ChatMe> {
  const sql = await getSql();
  const [row, isAdmin] = await Promise.all([loadMember(sql, userId), callerIsAdmin(sql, userId)]);
  return {
    signedIn: true,
    member: row ? toMember(row) : null,
    isAdmin,
    durable: dbSource !== "pglite",
    gifSearch: gifSearchEnabled(),
  };
}

export async function joinChat(
  userId: string,
  input: { handle: string; acceptRules: true },
): Promise<ChatMember> {
  const sql = await getSql();
  const existing = await loadMember(sql, userId);
  if (existing && isBanned(existing)) throw new Error("You can't post in the room.");
  const isAdmin = await callerIsAdmin(sql, userId);
  const parsed = validateHandle(input.handle, isAdmin);
  if (!parsed.ok) throw new Error(parsed.error);

  const taken = await sql<{ user_id: string }>`
    select user_id from chat_member
    where handle_key = ${parsed.handleKey} and user_id <> ${userId}
  `;
  if (taken.length > 0) throw new Error("That name's taken.");

  const now = Date.now();
  try {
    await sql`
      insert into chat_member (
        user_id, handle, handle_key, rules_version, rules_accepted_ms, created_ms
      ) values (
        ${userId}, ${parsed.handle}, ${parsed.handleKey}, ${CHAT_RULES_VERSION}, ${now}, ${now}
      )
      on conflict (user_id) do update set
        handle = excluded.handle,
        handle_key = excluded.handle_key,
        rules_version = excluded.rules_version,
        rules_accepted_ms = excluded.rules_accepted_ms
    `;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("That name's taken.");
    throw err;
  }

  const saved = await loadMember(sql, userId);
  if (!saved) throw new Error("Couldn’t join the room.");
  return toMember(saved, now);
}

export async function listChat(
  userId: string,
  input: { after?: number; before?: number },
): Promise<ChatList> {
  const sql = await getSql();
  await requireReader(sql, userId);
  const [rows, isAdmin] = await Promise.all([
    readMessages(sql, userId, input),
    callerIsAdmin(sql, userId),
  ]);
  let live: ChatLive = { isLive: false, sinceMs: null, source: null };
  try {
    live = await refreshLive();
  } catch {
    live = { isLive: false, sinceMs: null, source: null };
  }
  return {
    messages: rows.map((row) => toListItem(row, isAdmin)),
    nextPollMs: live.isLive ? 4_000 : NEXT_POLL_MS,
    live,
  };
}

async function readMessages(
  sql: Sql,
  userId: string,
  input: { after?: number; before?: number },
): Promise<MessageRow[]> {
  // `$1` flags the caller's own rows. The id is not selected or returned.
  if (input.after != null) {
    return sql.query<MessageRow>(
      `${MESSAGE_SELECT} where m.room = $2 and m.id > $3 order by m.id asc limit ${AFTER_LIMIT}`,
      [userId, ROOM, input.after],
    );
  }
  if (input.before != null) {
    const page = await sql.query<MessageRow>(
      `${MESSAGE_SELECT} where m.room = $2 and m.id < $3 order by m.id desc limit ${BEFORE_LIMIT}`,
      [userId, ROOM, input.before],
    );
    return page.reverse();
  }
  const page = await sql.query<MessageRow>(
    `${MESSAGE_SELECT} where m.room = $2 order by m.id desc limit ${LATEST_LIMIT}`,
    [userId, ROOM],
  );
  return page.reverse();
}

export async function postChat(
  userId: string,
  input: { body: string; nonce: string },
): Promise<ChatMessage> {
  void input.nonce;
  const sql = await getSql();
  const member = await requireReader(sql, userId);
  const now = Date.now();
  if (isMuted(member, now)) throw new Error("You're muted.");
  const normalized = normalizeBody(input.body);
  if (!normalized.ok) throw new Error(normalized.error);
  const blocked = containsBlockedWord(normalized.body, await activeBlockwords(sql));
  if (blocked) throw new Error("That message can't be posted.");
  const urls = countUrls(normalized.body);
  if (urls > MAX_URLS_PER_MESSAGE) throw new Error("Too many links in one message.");
  if (urls > 0 && CHAT_NEW_MEMBER_LINK_DELAY_MIN > 0 && !(await callerIsAdmin(sql, userId))) {
    const created = num(member.created_ms);
    if (Date.now() - created < CHAT_NEW_MEMBER_LINK_DELAY_MIN * 60_000) {
      throw new Error("New here? Links unlock after 10 minutes.");
    }
  }

  // One write batch. The INSERT reads the database clock and stores that same
  // value, so a replica or another isolate cannot make the gap look short.
  // A refusal inserts nothing. The second statement only explains the refusal.
  const dialect = dbSource === "turso" ? "sqlite" : "postgres";
  const [saved, rated] = (await sql.batch([
    { text: postAttemptSql(dialect), params: [ROOM, userId, normalized.body] },
    { text: rateSnapshotSql(dialect), params: [userId, ROOM] },
  ])) as [InsertedRow[], RateRow[]];
  const id = num(saved[0]?.id);
  if (id) {
    return {
      id,
      handle: member.handle,
      body: normalized.body,
      createdMs: num(saved[0]?.created_ms),
      kind: "text",
      mine: true,
    };
  }
  const decision = rateDecision(rated);
  if (!decision.nowMs) throw new Error(clockError(decision));
  throw new Error(refusal(decision));
}

type InsertedRow = { id: number | string | bigint; created_ms?: number | string | bigint };

function showRateDebug(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

function refusal(decision: RateDecision): string {
  const gap = decision.lastMs == null ? null : decision.nowMs - decision.lastMs;
  const debug = showRateDebug()
    ? rateDebug({ lastMs: decision.lastMs, nowMs: decision.nowMs, gapMs: gap })
    : undefined;
  return slowDownMessage(decision.waitMs ?? 1_000, debug);
}

function clockError(decision: RateDecision): string {
  const detail = showRateDebug()
    ? ` ${rateDebug({ lastMs: decision.lastMs, nowMs: decision.nowMs, gapMs: null })}`
    : "";
  return `Couldn't read the chat clock.${detail}`;
}

export async function deleteOwnMessage(
  userId: string,
  input: { id: number },
): Promise<{ id: number; deleted: true }> {
  const sql = await getSql();
  await requireReader(sql, userId);
  const rows = await sql<{ user_id: string | null; deleted_ms: number | string | bigint | null }>`
    select user_id, deleted_ms
    from chat_message
    where id = ${input.id} and room = ${ROOM}
  `;
  const row = rows[0];
  if (!row) throw new Error("That message is gone.");
  if (row.user_id !== userId) throw new Error("You can only remove your own messages.");
  if (row.deleted_ms != null) return { id: input.id, deleted: true };
  const now = Date.now();
  await sql`
    update chat_message
    set deleted_ms = ${now}, deleted_by = ${userId}
    where id = ${input.id} and user_id = ${userId} and deleted_ms is null
  `;
  return { id: input.id, deleted: true };
}

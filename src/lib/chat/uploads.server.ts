import { del, head } from "@vercel/blob";
import { blobCredentials } from "@/lib/chat/blob-env.server";
import { getSessionUser } from "@/lib/auth/verify.server";
import { dbSource, getSql, type Sql } from "@/lib/db";
import { CHAT_RULES_VERSION } from "@/lib/chat/rules";
import type { ChatAttachment } from "@/lib/chat/types";
import {
  blobPublicHost,
  classifyUpload,
  displayFileName,
  isTrustedBlobUrl,
  isUploadPathname,
  sanitizeFileName,
  settleUploadDeletes,
  uploadGateDecision,
  uploadInsertSql,
  uploadRateDecision,
  uploadSnapshotSql,
  UploadHttpError,
  type UploadKind,
} from "@/lib/chat/uploads";

type MemberRow = {
  rules_version: number | string | bigint;
  rules_accepted_ms: number | string | bigint | null;
  muted_until_ms: number | string | bigint | null;
  banned_ms: number | string | bigint | null;
  created_ms: number | string | bigint | null;
};

type UploadRow = {
  id: number | string | bigint;
  url: string;
  original_name: string;
  size: number | string | bigint;
  content_type: string;
  kind: string;
};

type CountRow = {
  now_ms: number | string | bigint | null;
  mine_count: number | string | bigint | null;
  room_count: number | string | bigint | null;
};

export type ListedUpload = {
  id: number;
  url: string;
  name: string;
  size: number;
  contentType: string;
  kind: UploadKind;
  createdMs: number;
  handle: string;
  messageId: number | null;
};

type TokenPayload = { userId: string; name: string; admin: boolean };

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

function adminEmails(): Set<string> {
  const extra = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(["spacebatshow@gmail.com", ...extra]);
}

export function blobUploadsEnabled(): boolean {
  return Boolean(blobCredentials().token);
}

export function configuredBlobHost(): string | null {
  const creds = blobCredentials();
  return blobPublicHost({ storeId: creds.storeId, token: creds.token });
}

function blobToken(): string {
  const token = blobCredentials().token;
  if (!token) throw new UploadHttpError(404, "Uploads are off.");
  return token;
}

function dialect(): "sqlite" | "postgres" {
  return dbSource === "turso" ? "sqlite" : "postgres";
}

async function profileIsAdmin(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ role: string }>`
    select role from member_profile where user_id = ${userId}
  `;
  return rows[0]?.role === "admin";
}

/** Crew check. The session address is a fallback and is never returned. */
async function callerIsAdmin(sql: Sql, userId: string): Promise<boolean> {
  if (await profileIsAdmin(sql, userId)) return true;
  const session = await getSessionUser();
  const address = session?.id === userId ? session.email?.trim().toLowerCase() : "";
  return Boolean(address && adminEmails().has(address));
}

async function loadMember(sql: Sql, userId: string): Promise<MemberRow | null> {
  const rows = await sql<MemberRow>`
    select rules_version, rules_accepted_ms, muted_until_ms, banned_ms, created_ms
    from chat_member
    where user_id = ${userId}
  `;
  return rows[0] ?? null;
}

function rulesAccepted(row: MemberRow): boolean {
  return num(row.rules_version) >= CHAT_RULES_VERSION && row.rules_accepted_ms != null;
}

function isMuted(row: MemberRow | null, now: number): boolean {
  return row?.muted_until_ms != null && num(row.muted_until_ms) > now;
}

async function readRate(sql: Sql, userId: string, isAdmin: boolean) {
  const [rows] = await sql.batch([{ text: uploadSnapshotSql(dialect()), params: [userId] }]);
  const row = (rows as CountRow[])[0];
  const nowMs = num(row?.now_ms);
  if (!nowMs) throw new UploadHttpError(500, "Couldn't read the chat clock.");
  return uploadRateDecision({
    mineInWindow: num(row?.mine_count),
    roomInWindow: num(row?.room_count),
    isAdmin,
  });
}

export async function assertCanUpload(userId: string, now = Date.now()): Promise<{ isAdmin: boolean }> {
  const sql = await getSql();
  const [member, isAdmin] = await Promise.all([
    loadMember(sql, userId),
    callerIsAdmin(sql, userId),
  ]);
  const gate = uploadGateDecision({
    signedIn: true,
    joined: Boolean(member),
    rulesAccepted: member ? rulesAccepted(member) : false,
    banned: member?.banned_ms != null,
    muted: isMuted(member, now),
    joinedMs: member?.created_ms == null ? null : num(member.created_ms),
    nowMs: now,
    isAdmin,
  });
  if (!gate.ok) throw new UploadHttpError(gate.status, gate.error);
  const rate = await readRate(sql, userId, isAdmin);
  if (!rate.ok) throw new UploadHttpError(429, rate.error);
  return { isAdmin };
}

function toAttachment(row: UploadRow): ChatAttachment | null {
  if (!isTrustedBlobUrl(row.url, configuredBlobHost())) return null;
  if (row.kind !== "image" && row.kind !== "file") return null;
  return {
    id: num(row.id),
    url: row.url,
    name: displayFileName(row.original_name),
    size: num(row.size),
    contentType: row.content_type,
    kind: row.kind,
  };
}

async function findOwnByPath(sql: Sql, userId: string, pathname: string): Promise<ChatAttachment | null> {
  const rows = await sql.query<UploadRow>(
    `select id, url, original_name, size, content_type, kind
     from chat_upload
     where pathname = $1 and user_id = $2 and deleted_ms is null`,
    [pathname, userId],
  );
  return rows[0] ? toAttachment(rows[0]) : null;
}

async function removeOneBlob(url: string): Promise<void> {
  if (!isTrustedBlobUrl(url, configuredBlobHost())) return;
  await del(url, { token: blobToken() });
}

export async function recordChatUpload(input: {
  userId: string;
  url: string;
  pathname: string;
  originalName: string;
  size: number;
  contentType: string;
  kind: UploadKind;
  isAdmin: boolean;
}): Promise<ChatAttachment> {
  if (!isTrustedBlobUrl(input.url, configuredBlobHost())) {
    throw new UploadHttpError(400, "That attachment isn't available.");
  }
  const sql = await getSql();
  try {
    const name = sanitizeFileName(input.originalName);
    const [saved, rated] = (await sql.batch([
      {
        text: uploadInsertSql(dialect()),
        params: [
          input.userId,
          input.url,
          input.pathname,
          name,
          input.size,
          input.contentType,
          input.kind,
          input.isAdmin ? 1 : 0,
        ],
      },
      { text: uploadSnapshotSql(dialect()), params: [input.userId] },
    ])) as [{ id?: number | string | bigint }[], CountRow[]];
    const id = num(saved[0]?.id);
    if (id) {
      return {
        id,
        url: input.url,
        name: displayFileName(name),
        size: input.size,
        contentType: input.contentType,
        kind: input.kind,
      };
    }
    const nowMs = num(rated[0]?.now_ms);
    if (!nowMs) throw new UploadHttpError(500, "Couldn't read the chat clock.");
    const decision = uploadRateDecision({
      mineInWindow: num(rated[0]?.mine_count),
      roomInWindow: num(rated[0]?.room_count),
      isAdmin: input.isAdmin,
    });
    throw new UploadHttpError(429, decision.ok ? "Couldn't save that upload." : decision.error);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await findOwnByPath(sql, input.userId, input.pathname);
    if (existing) return existing;
    throw new UploadHttpError(400, "That attachment isn't available.");
  }
}

async function ingestBlob(input: {
  userId: string;
  name: string;
  isAdmin: boolean;
  pathname: string;
}): Promise<ChatAttachment> {
  if (!isUploadPathname(input.pathname)) {
    throw new UploadHttpError(400, "That attachment isn't available.");
  }
  const sql = await getSql();
  const existing = await findOwnByPath(sql, input.userId, input.pathname);
  if (existing) return existing;
  let meta: Awaited<ReturnType<typeof head>>;
  try {
    meta = await head(input.pathname, { token: blobToken() });
  } catch {
    throw new UploadHttpError(400, "That file isn't ready yet. Try again.");
  }
  const classified = classifyUpload(meta.pathname || input.pathname, meta.contentType, meta.size);
  if (!classified.ok || !isTrustedBlobUrl(meta.url, configuredBlobHost())) {
    await removeOneBlob(meta.url).catch(() => undefined);
    throw new UploadHttpError(400, classified.ok ? "That attachment isn't available." : classified.error);
  }
  try {
    return await recordChatUpload({
      userId: input.userId,
      url: meta.url,
      pathname: meta.pathname,
      originalName: input.name,
      size: meta.size,
      contentType: classified.contentType,
      kind: classified.kind,
      isAdmin: input.isAdmin,
    });
  } catch (err) {
    if (err instanceof UploadHttpError && (err.status === 429 || err.status === 400)) {
      await removeOneBlob(meta.url).catch(() => undefined);
    }
    throw err;
  }
}

export async function prepareChatUpload(
  userId: string,
  input: { name: string; type: string; size: number },
): Promise<{ ok: true }> {
  const classified = classifyUpload(input.name, input.type, input.size);
  if (!classified.ok) throw new Error(classified.error);
  try {
    await assertCanUpload(userId);
  } catch (err) {
    if (err instanceof UploadHttpError) throw new Error(err.message);
    throw err;
  }
  return { ok: true };
}

export async function confirmChatUpload(
  userId: string,
  input: { pathname: string; name: string },
): Promise<ChatAttachment> {
  let isAdmin = false;
  try {
    const gate = await assertCanUpload(userId);
    isAdmin = gate.isAdmin;
  } catch (err) {
    if (err instanceof UploadHttpError) throw new Error(err.message);
    throw err;
  }
  try {
    return await ingestBlob({
      userId,
      name: input.name || input.pathname.split("/").pop() || "file",
      isAdmin,
      pathname: input.pathname,
    });
  } catch (err) {
    if (err instanceof UploadHttpError) throw new Error(err.message);
    throw err;
  }
}

function readTokenPayload(raw: string | null | undefined): TokenPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; name?: unknown; admin?: unknown };
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    if (typeof parsed.name !== "string") return null;
    return { userId: parsed.userId, name: parsed.name, admin: parsed.admin === 1 };
  } catch {
    return null;
  }
}

export async function completeBlobUpload(
  tokenPayload: string | null | undefined,
  blob: { url: string; pathname: string },
): Promise<void> {
  const payload = readTokenPayload(tokenPayload);
  if (!payload || !isUploadPathname(blob.pathname)) {
    await removeOneBlob(blob.url).catch(() => undefined);
    return;
  }
  const sql = await getSql();
  const member = await loadMember(sql, payload.userId);
  const now = Date.now();
  const profileAdmin = await profileIsAdmin(sql, payload.userId);
  const isAdmin = payload.admin || profileAdmin;
  const gate = uploadGateDecision({
    signedIn: true,
    joined: Boolean(member),
    rulesAccepted: member ? rulesAccepted(member) : false,
    banned: member?.banned_ms != null,
    muted: isMuted(member, now),
    joinedMs: member?.created_ms == null ? null : num(member.created_ms),
    nowMs: now,
    isAdmin,
  });
  if (!gate.ok) {
    await removeOneBlob(blob.url).catch(() => undefined);
    return;
  }
  try {
    await ingestBlob({
      userId: payload.userId,
      name: payload.name,
      isAdmin,
      pathname: blob.pathname,
    });
  } catch (err) {
    if (err instanceof UploadHttpError) return;
    throw err;
  }
}

export async function peekOwnUpload(sql: Sql, userId: string, uploadId: number): Promise<boolean> {
  const rows = await sql.query<{ id: number | string | bigint }>(
    `select id from chat_upload
     where id = $1 and user_id = $2 and message_id is null and deleted_ms is null`,
    [uploadId, userId],
  );
  return Boolean(rows[0]);
}

export async function takeUploadForMessage(
  sql: Sql,
  userId: string,
  uploadId: number,
  messageId: number,
): Promise<ChatAttachment | null> {
  const rows = await sql.query<UploadRow>(
    `update chat_upload
     set message_id = $1
     where id = $2 and user_id = $3 and message_id is null and deleted_ms is null
     returning id, url, original_name, size, content_type, kind`,
    [messageId, uploadId, userId],
  );
  return rows[0] ? toAttachment(rows[0]) : null;
}

export async function deleteUploadsForMessages(sql: Sql, messageIds: readonly number[]): Promise<void> {
  const ids = [...new Set(messageIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return;
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await sql.query<{ id: number | string | bigint; url: string }>(
    `select id, url from chat_upload where deleted_ms is null and message_id in (${placeholders})`,
    ids,
  );
  await markDeleted(sql, rows.map((row) => ({ id: num(row.id), url: String(row.url) })));
}

async function markDeleted(sql: Sql, rows: { id: number; url: string }[]): Promise<void> {
  const host = configuredBlobHost();
  const marked = await settleUploadDeletes(
    rows,
    (url) => isTrustedBlobUrl(url, host),
    (url) => removeOneBlob(url),
  );
  if (marked.length === 0) return;
  const placeholders = marked.map((_, index) => `$${index + 2}`).join(", ");
  await sql.query(
    `update chat_upload set deleted_ms = $1 where deleted_ms is null and id in (${placeholders})`,
    [Date.now(), ...marked],
  );
}

export async function discardOwnUpload(userId: string, uploadId: number): Promise<void> {
  const sql = await getSql();
  const rows = await sql.query<{ id: number | string | bigint; url: string }>(
    `select id, url from chat_upload
     where id = $1 and user_id = $2 and message_id is null and deleted_ms is null`,
    [uploadId, userId],
  );
  if (!rows[0]) return;
  await markDeleted(sql, [{ id: num(rows[0].id), url: String(rows[0].url) }]);
}

export async function listChatUploads(actorId: string): Promise<ListedUpload[]> {
  const sql = await getSql();
  if (!(await profileIsAdmin(sql, actorId))) throw new Error("Crew only.");
  const rows = await sql<{
    id: number | string | bigint;
    url: string;
    original_name: string;
    size: number | string | bigint;
    content_type: string;
    kind: string;
    created_ms: number | string | bigint;
    message_id: number | string | bigint | null;
    handle: string | null;
  }>`
    select u.id, u.url, u.original_name, u.size, u.content_type, u.kind, u.created_ms, u.message_id, c.handle
    from chat_upload u
    left join chat_member c on c.user_id = u.user_id
    where u.deleted_ms is null
    order by u.created_ms desc
    limit 50
  `;
  const host = configuredBlobHost();
  const listed: ListedUpload[] = [];
  for (const row of rows) {
    if (row.kind !== "image" && row.kind !== "file") continue;
    if (!isTrustedBlobUrl(row.url, host)) continue;
    listed.push({
      id: num(row.id),
      url: row.url,
      name: displayFileName(row.original_name),
      size: num(row.size),
      contentType: row.content_type,
      kind: row.kind,
      createdMs: num(row.created_ms),
      handle: row.handle?.trim() || "Listener",
      messageId: row.message_id == null ? null : num(row.message_id),
    });
  }
  return listed;
}

export async function adminDeleteChatUpload(actorId: string, uploadId: number): Promise<{ id: number }> {
  const sql = await getSql();
  if (!(await profileIsAdmin(sql, actorId))) throw new Error("Crew only.");
  const rows = await sql.query<{ id: number | string | bigint; url: string }>(
    `select id, url from chat_upload where id = $1 and deleted_ms is null`,
    [uploadId],
  );
  if (!rows[0]) throw new Error("That upload is already gone.");
  const id = num(rows[0].id);
  await markDeleted(sql, [{ id, url: String(rows[0].url) }]);
  const still = await sql.query<{ id: number | string | bigint }>(
    `select id from chat_upload where id = $1 and deleted_ms is null`,
    [id],
  );
  if (still[0]) throw new Error("Couldn't delete that file. Try again.");
  return { id };
}

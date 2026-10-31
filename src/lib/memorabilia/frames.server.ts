import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, put } from "@vercel/blob";
import { blobCredentials } from "@/lib/chat/blob-env.server";
import { blobPublicHost, isTrustedBlobUrl } from "@/lib/chat/uploads";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { getSessionUser, requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { dbSource, getSql, type Sql } from "@/lib/db";
import {
  acceptMemorabiliaUpload,
  authorizeFrameDelete,
  authorizeFrameMove,
  collectionPageModel,
  isSafeFrameSrc,
  LOCAL_UPLOAD_SRC,
  memorabiliaAdminDecision,
  MemorabiliaHttpError,
  movedIds,
  type PublicFrame,
  type StoredFrame,
} from "@/lib/memorabilia/frames";

const UPLOAD_DIR = join(process.cwd(), "public", "memorabilia", "uploads");
const LOCAL_FILE = /^[a-f0-9]{32}\.(jpg|png|gif|webp)$/;
const BODY_LIMIT = 5 * 1024 * 1024;

type FrameRow = {
  id: unknown;
  url: string;
  alt_text: string;
  caption: string;
  sort_order?: unknown;
};

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function blobHost(): string | null {
  const creds = blobCredentials();
  return blobPublicHost({ storeId: creds.storeId, token: creds.token });
}

async function roleOf(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<{ role: string }>`
    select role from member_profile where user_id = ${userId}
  `;
  return rows[0]?.role ?? null;
}

async function readRows(sql: Sql): Promise<StoredFrame[]> {
  const rows = await sql<FrameRow>`
    select id, url, alt_text, caption
    from memorabilia_frame
    order by sort_order asc, id asc
  `;
  const stored: StoredFrame[] = [];
  for (const row of rows) {
    const id = num(row.id);
    if (id <= 0) continue;
    stored.push({
      id,
      src: String(row.url ?? ""),
      alt: String(row.alt_text ?? ""),
      caption: String(row.caption ?? ""),
    });
  }
  return stored;
}

/**
 * Public list plus the crew flag. A database problem still returns frame 1
 * and hides the upload desk.
 */
export async function loadCollectionPage(): Promise<{ frames: PublicFrame[]; canManage: boolean }> {
  const session = await getSessionUser();
  let role: string | null = null;
  let rows: StoredFrame[] = [];
  try {
    const sql = await getSql();
    if (session) role = await roleOf(sql, session.id);
    rows = await readRows(sql);
  } catch (err) {
    console.error("memorabilia list", err instanceof Error ? err.message : "error");
  }
  return collectionPageModel({
    rows,
    signedIn: Boolean(session),
    role,
    blobHost: blobHost(),
  });
}

/**
 * Chat's Vercel Blob store when a token is configured. A local PGLite process
 * with no token writes under public/memorabilia/uploads so a throwaway dev
 * database can still hang a frame. Turso without a token does not write.
 */
async function storeBytes(
  pathname: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ url: string; pathname: string }> {
  const token = blobCredentials().token;
  if (token) {
    const blob = await put(pathname, Buffer.from(bytes), {
      access: "public",
      token,
      contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  }
  if (dbSource !== "pglite") {
    throw new MemorabiliaHttpError(503, "Uploads are off.");
  }
  const file = pathname.split("/").pop() ?? "";
  if (!LOCAL_FILE.test(file)) throw new MemorabiliaHttpError(500, "Couldn't store that picture.");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, file), bytes);
  return { url: `/memorabilia/uploads/${file}`, pathname: `local/${file}` };
}

async function removeStored(url: string): Promise<void> {
  const host = blobHost();
  if (isTrustedBlobUrl(url, host)) {
    const token = blobCredentials().token;
    if (!token) throw new MemorabiliaHttpError(503, "Uploads are off.");
    await del(url, { token });
    return;
  }
  const local = localFileName(url);
  if (!local) return;
  try {
    await unlink(join(UPLOAD_DIR, local));
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code !== "ENOENT") throw err;
  }
}

function localFileName(url: string): string | null {
  if (!LOCAL_UPLOAD_SRC.test(url)) return null;
  return url.slice("/memorabilia/uploads/".length);
}

function bearerFrom(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)/i.exec(header) : null;
  return match?.[1];
}

function json(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function uploadMemorabilia(request: Request): Promise<Response> {
  try {
    assertSameSiteRequest();
    const userId = await requireUserId(bearerFrom(request));
    const sql = await getSql();
    const role = await roleOf(sql, userId);
    const allowed = memorabiliaAdminDecision({ signedIn: true, role });
    if (!allowed.ok) return json(allowed.status, allowed.error);
    const declared = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > BODY_LIMIT) {
      return json(400, "Pictures need to be 4 MB or smaller.");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json(400, "Choose a picture.");
    }
    const file = form.get("file");
    const captionField = form.get("caption");
    if (!(file instanceof File)) return json(400, "Choose a picture.");
    if (captionField != null && typeof captionField !== "string") {
      return json(400, "Caption needs to be text.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await acceptMemorabiliaUpload({
      signedIn: true,
      role,
      name: file.name,
      contentType: file.type,
      bytes,
      caption: typeof captionField === "string" ? captionField : "",
      put: (item) => storeBytes(item.pathname, item.bytes, item.contentType),
    });
    if (!result.ok) return json(result.status, result.error);
    const host = blobHost();
    const safe = isSafeFrameSrc(result.url, host);
    const localOnTurso = dbSource !== "pglite" && LOCAL_UPLOAD_SRC.test(result.url);
    if (!safe || localOnTurso) {
      await removeStored(result.url).catch(() => undefined);
      return json(500, "Couldn't store that picture.");
    }
    try {
      const existing = await sql<{ n: unknown }>`select count(*) as n from memorabilia_frame`;
      const sort = num(existing[0]?.n) + 1;
      await sql`
        insert into memorabilia_frame
          (url, pathname, alt_text, caption, sort_order, created_ms, created_by)
        values (
          ${result.url},
          ${result.pathname},
          ${result.alt},
          ${result.caption},
          ${sort},
          ${Date.now()},
          ${userId}
        )
      `;
    } catch (err) {
      await removeStored(result.url).catch(() => undefined);
      throw err;
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
    if (err instanceof CrossSiteRequestError) return json(403, err.message);
    if (err instanceof MemorabiliaHttpError) return json(err.status, err.message);
    console.error("memorabilia upload", err instanceof Error ? err.message : "error");
    return json(500, "Couldn't store that picture.");
  }
}

async function orderedIds(sql: Sql): Promise<number[]> {
  const rows = await sql<{ id: unknown }>`
    select id from memorabilia_frame order by sort_order asc, id asc
  `;
  return rows.map((row) => num(row.id)).filter((id) => id > 0);
}

async function writeOrder(sql: Sql, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await sql.batch(
    ids.map((id, index) => ({
      text: "update memorabilia_frame set sort_order = $1 where id = $2",
      params: [index + 1, id],
    })),
  );
}

export async function deleteMemorabiliaFrame(userId: string, frameId: number): Promise<void> {
  const sql = await getSql();
  const role = await roleOf(sql, userId);
  const auth = authorizeFrameDelete({ signedIn: true, role, frameId: String(frameId) });
  if (!auth.ok) throw new Error(auth.error);
  const rows = await sql<{ id: unknown; url: string }>`
    select id, url from memorabilia_frame where id = ${auth.id}
  `;
  const row = rows[0];
  if (!row) throw new Error("That frame isn't on the page.");
  try {
    await removeStored(String(row.url));
  } catch {
    throw new Error("Couldn't delete that frame. Try again.");
  }
  await sql`delete from memorabilia_frame where id = ${auth.id}`;
  await writeOrder(sql, await orderedIds(sql));
}

export async function moveMemorabiliaFrame(
  userId: string,
  frameId: number,
  direction: "earlier" | "later",
): Promise<void> {
  const sql = await getSql();
  const role = await roleOf(sql, userId);
  const auth = authorizeFrameMove({
    signedIn: true,
    role,
    frameId: String(frameId),
    direction,
  });
  if (!auth.ok) throw new Error(auth.error);
  const ids = await orderedIds(sql);
  const next = movedIds(ids, auth.id, auth.direction);
  if (!next) return;
  await writeOrder(sql, next);
}

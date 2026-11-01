import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, head, put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { blobCredentials } from "@/lib/chat/blob-env.server";
import { blobPublicHost, isTrustedBlobUrl } from "@/lib/chat/uploads";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { getSessionUser, requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { dbSource, getSql, type Sql } from "@/lib/db";
import { stripLocationMetadata } from "@/lib/memorabilia/gps";
import {
  altForUpload,
  authorizeFrameDelete,
  authorizeFrameMove,
  classifyMemorabiliaImage,
  cleanCaption,
  collectionPageModel,
  framePixelSize,
  imagePixelSize,
  LOCAL_UPLOAD_SRC,
  memorabiliaAdminDecision,
  memorabiliaFinalizeDecision,
  memorabiliaPathname,
  memorabiliaTokenDecision,
  MemorabiliaHttpError,
  MEMORABILIA_MAX_BYTES,
  movedIds,
  previousFrameFile,
  type PublicFrame,
  type StoredFrame,
} from "@/lib/memorabilia/frames";

const UPLOAD_DIR = join(process.cwd(), "public", "memorabilia", "uploads");
const LOCAL_FILE = /^[a-f0-9]{32}\.(jpg|png|gif|webp|heic|heif)$/;
const DIRECT_BODY_LIMIT = MEMORABILIA_MAX_BYTES + 1024 * 1024;

type FrameRow = {
  id: unknown;
  url: string;
  alt_text: string;
  caption: string;
  width?: unknown;
  height?: unknown;
  sort_order?: unknown;
};

const DISPLAYABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
    select id, url, alt_text, caption, width, height
    from memorabilia_frame
    order by sort_order asc, id asc
  `;
  const stored: StoredFrame[] = [];
  for (const row of rows) {
    const id = num(row.id);
    if (id <= 0) continue;
    const width = framePixelSize(num(row.width));
    const height = framePixelSize(num(row.height));
    stored.push({
      id,
      src: String(row.url ?? ""),
      alt: String(row.alt_text ?? ""),
      caption: String(row.caption ?? ""),
      width: width ?? undefined,
      height: height ?? undefined,
    });
  }
  return stored;
}

/**
 * Public list plus the crew flag. A database problem returns an empty wall
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

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code) : "";
  const message = "message" in err ? String(err.message) : "";
  return code === "23505" || /unique|SQLITE_CONSTRAINT/i.test(message);
}

function readDeclared(raw: string | null): {
  name: string;
  type: string;
  size: number;
  caption: string;
} | null {
  if (!raw || raw.length > 2_000) return null;
  try {
    const parsed = JSON.parse(raw) as {
      name?: unknown;
      type?: unknown;
      size?: unknown;
      caption?: unknown;
    };
    if (typeof parsed.name !== "string" || typeof parsed.type !== "string") return null;
    if (typeof parsed.size !== "number" || !Number.isFinite(parsed.size)) return null;
    const caption = cleanCaption(typeof parsed.caption === "string" ? parsed.caption : "");
    if (typeof caption !== "string") return null;
    return { name: parsed.name, type: parsed.type, size: parsed.size, caption };
  } catch {
    return null;
  }
}

async function nextSort(sql: Sql): Promise<number> {
  const existing = await sql<{ n: unknown }>`select count(*) as n from memorabilia_frame`;
  return num(existing[0]?.n) + 1;
}

async function insertFrame(
  sql: Sql,
  input: {
    url: string;
    pathname: string;
    originalUrl: string | null;
    originalPathname: string | null;
    alt: string;
    caption: string;
    userId: string;
    width: number | null;
    height: number | null;
  },
): Promise<void> {
  const sort = await nextSort(sql);
  await sql`
    insert into memorabilia_frame
      (url, pathname, original_url, original_pathname, alt_text, caption, sort_order, created_ms, created_by, width, height)
    values (
      ${input.url},
      ${input.pathname},
      ${input.originalUrl},
      ${input.originalPathname},
      ${input.alt},
      ${input.caption},
      ${sort},
      ${Date.now()},
      ${input.userId},
      ${input.width},
      ${input.height}
    )
  `;
}

async function lookupBlob(pathname: string): Promise<{ url: string; pathname: string; contentType: string; size: number }> {
  const token = blobCredentials().token;
  if (!token) throw new MemorabiliaHttpError(503, "Uploads are off.");
  let meta: Awaited<ReturnType<typeof head>>;
  try {
    meta = await head(pathname, { token });
  } catch {
    throw new MemorabiliaHttpError(400, "That file isn't ready yet. Try again.");
  }
  const type = meta.contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!DISPLAYABLE.has(type) && type !== "image/heic" && type !== "image/heif" && !type.endsWith("heic-sequence") && !type.endsWith("heif-sequence")) {
    throw new MemorabiliaHttpError(400, "That file type isn't allowed.");
  }
  if (meta.size <= 0 || meta.size > MEMORABILIA_MAX_BYTES) {
    throw new MemorabiliaHttpError(400, "Pictures need to be 25 MB or smaller.");
  }
  if (!isTrustedBlobUrl(meta.url, blobHost())) {
    throw new MemorabiliaHttpError(400, "That picture isn't available.");
  }
  return { url: meta.url, pathname: meta.pathname, contentType: type, size: meta.size };
}

/**
 * Blob client-token route. Bytes go to Vercel Blob, not through this function.
 * 401 signed out, 403 for listeners, images only, 25 MB cap.
 */
export async function handleMemorabiliaClientUpload(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json(400, "That file type isn't allowed.");
  }
  if (!body || (body.type !== "blob.generate-client-token" && body.type !== "blob.upload-completed")) {
    return json(400, "That file type isn't allowed.");
  }

  let userId: string | null = null;
  if (body.type === "blob.generate-client-token") {
    try {
      assertSameSiteRequest();
      userId = await requireUserId(bearerFrom(request));
      const role = await roleOf(await getSql(), userId);
      const allowed = memorabiliaAdminDecision({ signedIn: true, role });
      if (!allowed.ok) return json(allowed.status, allowed.error);
    } catch (err) {
      if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
      if (err instanceof CrossSiteRequestError) return json(403, err.message);
      if (err instanceof MemorabiliaHttpError) return json(err.status, err.message);
      const message = err instanceof Error ? err.message : "Unauthorized";
      return json(message === "Unauthorized" ? 401 : 403, message);
    }
  }

  if (!blobCredentials().token) return json(503, "Uploads are off.");

  try {
    const result = await handleUpload({
      token: blobCredentials().token,
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!userId) throw new MemorabiliaHttpError(401, "Unauthorized");
        const sql = await getSql();
        const role = await roleOf(sql, userId);
        const declared = readDeclared(clientPayload);
        if (!declared) throw new MemorabiliaHttpError(400, "That file type isn't allowed.");
        const decision = memorabiliaTokenDecision({
          signedIn: true,
          role,
          name: declared.name,
          contentType: declared.type,
          size: declared.size,
          pathname,
        });
        if (!decision.ok) throw new MemorabiliaHttpError(decision.status, decision.error);
        return {
          allowedContentTypes: [decision.contentType],
          maximumSizeInBytes: decision.maximumSizeInBytes,
          addRandomSuffix: false,
          validUntil: Date.now() + 5 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof MemorabiliaHttpError) return json(err.status, err.message);
    if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
    const message = err instanceof Error && err.message ? err.message : "Couldn't upload that picture.";
    console.error("memorabilia upload", message);
    return json(400, message);
  }
}

/** Admin-checked row write after the browser finishes a blob upload. */
export async function recordMemorabiliaFrame(
  userId: string,
  input: { pathname: string; originalPathname?: string; caption: string; width?: number | null; height?: number | null },
): Promise<{ ok: true }> {
  const sql = await getSql();
  const role = await roleOf(sql, userId);
  const auth = memorabiliaAdminDecision({ signedIn: true, role });
  if (!auth.ok) throw new Error(auth.error);
  const caption = cleanCaption(input.caption);
  if (typeof caption !== "string") throw new Error(caption.error);
  const existing = await sql<{ id: unknown }>`
    select id from memorabilia_frame where pathname = ${input.pathname}
  `;
  if (existing[0] && !input.originalPathname) return { ok: true };
  const display = await lookupBlob(input.pathname);
  let original: { url: string; pathname: string; contentType: string; size: number } | null = null;
  if (input.originalPathname) original = await lookupBlob(input.originalPathname);
  const decision = memorabiliaFinalizeDecision({
    signedIn: true,
    role,
    displayContentType: display.contentType,
    displaySize: display.size,
    originalContentType: original?.contentType,
    originalSize: original?.size,
  });
  if (!decision.ok) throw new Error(decision.error);
  const originalUrl = original?.url ?? null;
  const originalPathname = original?.pathname ?? null;
  if (existing[0]) {
    await sql`
      update memorabilia_frame
      set original_url = ${originalUrl}, original_pathname = ${originalPathname}
      where pathname = ${input.pathname}
    `;
    return { ok: true };
  }
  try {
    await insertFrame(sql, {
      url: display.url,
      pathname: display.pathname,
      originalUrl,
      originalPathname,
      alt: altForUpload(caption),
      caption,
      userId,
      width: input.width ?? null,
      height: input.height ?? null,
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  return { ok: true };
}

/** Swap the picture on an existing frame. Static files are never deleted. */
export async function replaceMemorabiliaFrame(
  userId: string,
  input: { id: number; pathname: string; originalPathname?: string; width?: number | null; height?: number | null },
): Promise<{ ok: true }> {
  const sql = await getSql();
  const role = await roleOf(sql, userId);
  const auth = authorizeFrameDelete({ signedIn: true, role, frameId: String(input.id) });
  if (!auth.ok) throw new Error(auth.error);
  const rows = await sql<{ url: string; original_url: string | null }>`
    select url, original_url from memorabilia_frame where id = ${auth.id}
  `;
  const current = rows[0];
  if (!current) throw new Error("That frame isn't on the page.");
  const display = await lookupBlob(input.pathname);
  let original: { url: string; pathname: string; contentType: string; size: number } | null = null;
  if (input.originalPathname) original = await lookupBlob(input.originalPathname);
  const decision = memorabiliaFinalizeDecision({
    signedIn: true,
    role,
    displayContentType: display.contentType,
    displaySize: display.size,
    originalContentType: original?.contentType,
    originalSize: original?.size,
  });
  if (!decision.ok) throw new Error(decision.error);
  const originalUrl = original?.url ?? null;
  const originalPathname = original?.pathname ?? null;
  await sql`
    update memorabilia_frame
    set url = ${display.url},
        pathname = ${display.pathname},
        original_url = ${originalUrl},
        original_pathname = ${originalPathname},
        width = ${input.width ?? null},
        height = ${input.height ?? null}
    where id = ${auth.id}
  `;
  await forgetPreviousFiles([String(current.url), current.original_url ? String(current.original_url) : null], [
    display.url,
    originalUrl,
  ]);
  return { ok: true };
}

export async function updateMemorabiliaCaption(
  userId: string,
  frameId: number,
  captionInput: string,
): Promise<{ ok: true }> {
  const sql = await getSql();
  const role = await roleOf(sql, userId);
  const auth = authorizeFrameDelete({ signedIn: true, role, frameId: String(frameId) });
  if (!auth.ok) throw new Error(auth.error);
  const caption = cleanCaption(captionInput);
  if (typeof caption !== "string") throw new Error(caption.error);
  const rows = await sql<{ id: unknown }>`
    update memorabilia_frame
    set caption = ${caption}, alt_text = ${altForUpload(caption)}
    where id = ${auth.id}
    returning id
  `;
  if (!rows[0]) throw new Error("That frame isn't on the page.");
  return { ok: true };
}

async function forgetPreviousFiles(previous: readonly (string | null)[], next: readonly (string | null)[]): Promise<void> {
  const kept = new Set(next.filter((url): url is string => Boolean(url)));
  const host = blobHost();
  for (const url of previous) {
    if (!url || kept.has(url)) continue;
    if (previousFrameFile(url, host) === "keep") continue;
    try {
      await removeStored(url);
    } catch (err) {
      console.error("memorabilia replace", err instanceof Error ? err.message : "error");
    }
  }
}

/**
 * Throwaway local database only. Preview and production send the file to Blob
 * and never post the bytes here.
 */
export async function saveDirectMemorabilia(request: Request): Promise<Response> {
  if (dbSource !== "pglite") return json(404, "Uploads are off.");
  try {
    assertSameSiteRequest();
    const userId = await requireUserId(bearerFrom(request));
    const sql = await getSql();
    const role = await roleOf(sql, userId);
    const allowed = memorabiliaAdminDecision({ signedIn: true, role });
    if (!allowed.ok) return json(allowed.status, allowed.error);
    const declared = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > DIRECT_BODY_LIMIT * 2) {
      return json(400, "Pictures need to be 25 MB or smaller.");
    }
    const form = await request.formData();
    const file = form.get("file");
    const original = form.get("original");
    const captionField = form.get("caption");
    if (!(file instanceof File)) return json(400, "Choose a picture.");
    const caption = cleanCaption(typeof captionField === "string" ? captionField : "");
    if (typeof caption !== "string") return json(400, caption.error);
    const stored = await storeCheckedFile(file);
    if (!stored.ok) return json(stored.status, stored.error);
    if (!DISPLAYABLE.has(stored.contentType)) return json(400, "That file type isn't allowed.");
    let originalUrl: string | null = null;
    let originalPathname: string | null = null;
    if (original instanceof File && original.size > 0) {
      const kept = await storeCheckedFile(original, { preserve: true });
      if (!kept.ok) {
        await removeStored(stored.url).catch(() => undefined);
        return json(kept.status, kept.error);
      }
      originalUrl = kept.url;
      originalPathname = kept.pathname;
    }
    const frameField = form.get("frameId");
    const frameId = typeof frameField === "string" ? Number(frameField) : NaN;
    if (Number.isInteger(frameId) && frameId > 0) {
      const auth = authorizeFrameDelete({ signedIn: true, role, frameId: String(frameId) });
      if (!auth.ok) {
        await removeStored(stored.url).catch(() => undefined);
        if (originalUrl) await removeStored(originalUrl).catch(() => undefined);
        return json(auth.status, auth.error);
      }
      const existing = await sql<{ url: string; original_url: string | null }>`
        select url, original_url from memorabilia_frame where id = ${auth.id}
      `;
      const current = existing[0];
      if (!current) {
        await removeStored(stored.url).catch(() => undefined);
        if (originalUrl) await removeStored(originalUrl).catch(() => undefined);
        return json(400, "That frame isn't on the page.");
      }
      await sql`
        update memorabilia_frame
        set url = ${stored.url},
            pathname = ${stored.pathname},
            original_url = ${originalUrl},
            original_pathname = ${originalPathname},
            width = ${stored.width},
            height = ${stored.height}
        where id = ${auth.id}
      `;
      await forgetPreviousFiles(
        [String(current.url), current.original_url ? String(current.original_url) : null],
        [stored.url, originalUrl],
      );
      return Response.json({ ok: true });
    }
    try {
      await insertFrame(sql, {
        url: stored.url,
        pathname: stored.pathname,
        originalUrl,
        originalPathname,
        alt: altForUpload(caption),
        caption,
        userId,
        width: stored.width,
        height: stored.height,
      });
    } catch (err) {
      await removeStored(stored.url).catch(() => undefined);
      if (originalUrl) await removeStored(originalUrl).catch(() => undefined);
      throw err;
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
    if (err instanceof CrossSiteRequestError) return json(403, err.message);
    if (err instanceof MemorabiliaHttpError) return json(err.status, err.message);
    console.error("memorabilia direct", err instanceof Error ? err.message : "error");
    return json(500, "Couldn't store that picture.");
  }
}

async function storeCheckedFile(
  file: File,
  options?: { preserve?: boolean },
): Promise<
  | { ok: true; url: string; pathname: string; contentType: string; width: number | null; height: number | null }
  | { ok: false; status: number; error: string }
> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const classified = classifyMemorabiliaImage(file.name || "picture.jpg", file.type || "", bytes);
  if (!classified.ok) return { ok: false, status: 400, error: classified.error };
  const prepared = options?.preserve ? bytes : stripLocationMetadata(bytes, classified.contentType);
  const pathname = memorabiliaPathname(classified.extension);
  const stored = await storeBytes(pathname, prepared, classified.contentType);
  const pixels = imagePixelSize(prepared, classified.contentType);
  return {
    ok: true,
    url: stored.url,
    pathname: stored.pathname,
    contentType: classified.contentType,
    width: pixels?.width ?? null,
    height: pixels?.height ?? null,
  };
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
  const rows = await sql<{ id: unknown; url: string; original_url: string | null }>`
    select id, url, original_url from memorabilia_frame where id = ${auth.id}
  `;
  const row = rows[0];
  if (!row) throw new Error("That frame isn't on the page.");
  try {
    await removeStored(String(row.url));
    if (row.original_url) await removeStored(String(row.original_url));
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

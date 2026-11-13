import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { blobCredentials } from "@/lib/chat/blob-env.server";
import { classifyUpload, IMAGE_MAX_BYTES } from "@/lib/chat/uploads";
import { blobUploadsEnabled } from "@/lib/chat/uploads.server";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { getSessionUser, requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { dbSource, getSql, type Sql } from "@/lib/db";
import { hostForEmail } from "@/lib/media";
import { safeImageUrl as publicImageUrl } from "../chat/link-preview.ts";
import { classifyImageBytes, TECH_IMAGE_MAX_BYTES } from "@/lib/tech/image-file";
import { readPageMeta } from "@/lib/tech/page-meta";
import { fetchTechResource, PREVIEW_MAX_BYTES, PublicFetchError } from "@/lib/tech/fetch-public";
import {
  deleteTechProduct,
  listTechProducts,
  parseHttpUrl,
  saveTechProduct,
  TECH_BLOB_PATH,
  techAdminDecision,
  type FetchedProduct,
  type TechProduct,
} from "@/lib/tech/products";

const UPLOAD_DIR = join(process.cwd(), "public", "tech", "uploads");
const LOCAL_FILE = /^[a-f0-9]{32}\.(jpg|png|gif|webp)$/;

export type TechPageData = {
  products: TechProduct[];
  canManage: boolean;
  viewerHost: "john" | "dan" | null;
};

async function roleOf(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<{ role: string | null }>`
    select role from member_profile where user_id = ${userId}
  `;
  return rows[0]?.role ?? null;
}

export async function loadTechPage(): Promise<TechPageData> {
  const session = await getSessionUser();
  let products: TechProduct[] = [];
  let role: string | null = null;
  try {
    const sql = await getSql();
    if (session) role = await roleOf(sql, session.id);
    products = await listTechProducts(sql);
  } catch (err) {
    console.error("tech list", err instanceof Error ? err.message : "error");
  }
  const canManage = techAdminDecision({ signedIn: Boolean(session), role }).ok;
  const viewerHost = canManage ? hostForEmail(session?.email) : null;
  return { products, canManage, viewerHost };
}

export async function fetchProductPage(url: string): Promise<FetchedProduct | null> {
  let resource;
  try {
    resource = await fetchTechResource(url, { maxBytes: PREVIEW_MAX_BYTES });
  } catch (err) {
    if (err instanceof PublicFetchError && err.code === "blocked") throw err;
    return null;
  }
  const type = resource.contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("image/")) {
    return { title: null, description: null, imageUrl: resource.finalUrl };
  }
  const meta = readPageMeta(new TextDecoder().decode(resource.body), resource.finalUrl);
  const image = meta.imageUrl ? publicImageUrl(meta.imageUrl, resource.finalUrl) : null;
  return { title: meta.title, description: meta.description, imageUrl: image };
}

function storedName(extension: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const random = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const month = new Date();
  const folder = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  return `tech/${folder}/${random}.${extension}`;
}

async function storeTechImage(
  bytes: Uint8Array,
  contentType: string,
  extension: string,
): Promise<string | null> {
  const pathname = storedName(extension);
  const token = blobCredentials().token;
  if (token) {
    const blob = await put(pathname, Buffer.from(bytes), {
      access: "public",
      token,
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }
  if (dbSource !== "pglite") return null;
  const file = pathname.split("/").pop() ?? "";
  if (!LOCAL_FILE.test(file)) return null;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, file), bytes);
  return `/tech/uploads/${file}`;
}

export async function copyProductImage(url: string): Promise<{ url: string | null; keepRemote: boolean }> {
  let resource;
  try {
    resource = await fetchTechResource(url, {
      maxBytes: TECH_IMAGE_MAX_BYTES,
      accept: "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.5",
    });
  } catch (err) {
    if (err instanceof PublicFetchError && err.code === "blocked") {
      return { url: null, keepRemote: false };
    }
    return { url: null, keepRemote: true };
  }
  if (resource.truncated) return { url: null, keepRemote: false };
  const decision = classifyImageBytes(resource.contentType, resource.body, resource.body.byteLength);
  if (!decision.ok) return { url: null, keepRemote: false };
  try {
    const stored = await storeTechImage(resource.body, decision.contentType, decision.extension);
    if (!stored) return { url: null, keepRemote: true };
    return { url: stored, keepRemote: false };
  } catch (err) {
    console.error("tech image", err instanceof Error ? err.message : "error");
    return { url: null, keepRemote: true };
  }
}

export async function saveTechProductForUser(userId: string, input: unknown): Promise<TechProduct> {
  const sql = await getSql();
  return saveTechProduct(sql, userId, input, {
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    fetchProduct: fetchProductPage,
    copyImage: copyProductImage,
  });
}

export async function deleteTechProductForUser(userId: string, id: string): Promise<void> {
  const sql = await getSql();
  await deleteTechProduct(sql, userId, id);
}

export async function previewTechProductForUser(
  userId: string,
  url: string,
): Promise<{ name: string; description: string; autoImageUrl: string | null }> {
  const sql = await getSql();
  const decision = techAdminDecision({ signedIn: Boolean(userId), role: await roleOf(sql, userId) });
  if (!decision.ok) throw new Error(decision.error);
  const parsed = parseHttpUrl(url);
  if ("error" in parsed) throw new Error(parsed.error);
  let fetched: FetchedProduct | null;
  try {
    fetched = await fetchProductPage(parsed.toString());
  } catch (err) {
    if (err instanceof PublicFetchError && err.code === "blocked") throw new Error(err.message);
    throw new Error("Couldn't read that page.");
  }
  if (!fetched) throw new Error("Couldn't read that page.");
  return {
    name: fetched.title?.trim() ?? "",
    description: fetched.description?.trim() ?? "",
    autoImageUrl: fetched.imageUrl,
  };
}

function json(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

function readDeclared(raw: string | null): { name: string; type: string; size: number } | null {
  if (!raw || raw.length > 1_000) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; type?: unknown; size?: unknown };
    if (typeof parsed.name !== "string" || typeof parsed.type !== "string") return null;
    if (typeof parsed.size !== "number" || !Number.isFinite(parsed.size)) return null;
    return { name: parsed.name, type: parsed.type, size: parsed.size };
  } catch {
    return null;
  }
}

export async function handleTechClientUpload(request: Request): Promise<Response> {
  if (!blobUploadsEnabled()) return json(404, "Uploads are off.");
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
      userId = await requireUserId();
      const role = await roleOf(await getSql(), userId);
      const allowed = techAdminDecision({ signedIn: true, role });
      if (!allowed.ok) return json(allowed.status, allowed.error);
    } catch (err) {
      if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
      if (err instanceof CrossSiteRequestError) return json(403, err.message);
      const message = err instanceof Error ? err.message : "Unauthorized";
      return json(message === "Unauthorized" ? 401 : 403, message);
    }
  }

  try {
    const result = await handleUpload({
      token: blobCredentials().token,
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!userId) throw new Error("Unauthorized");
        if (!TECH_BLOB_PATH.test(pathname)) throw new Error("That file type isn't allowed.");
        const declared = readDeclared(clientPayload);
        if (!declared) throw new Error("That file type isn't allowed.");
        const classified = classifyUpload(declared.name, declared.type, declared.size);
        if (!classified.ok || classified.kind !== "image") {
          throw new Error(classified.ok ? "That file type isn't allowed." : classified.error);
        }
        return {
          allowedContentTypes: [classified.contentType],
          maximumSizeInBytes: Math.min(classified.maxBytes, IMAGE_MAX_BYTES),
          addRandomSuffix: false,
          validUntil: Date.now() + 5 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return json(401, "Unauthorized");
    const message = err instanceof Error && err.message ? err.message : "Couldn't upload that picture.";
    console.error("tech upload", message);
    return json(400, message);
  }
}

import { CHAT_NEW_MEMBER_LINK_DELAY_MIN } from "./render.ts";
import { dbNowSql } from "./post-insert.ts";

export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_MEMBER_MAX = 5;
export const UPLOAD_MEMBER_WINDOW_MS = 10 * 60 * 1000;
export const UPLOAD_ROOM_MAX = 50;
export const UPLOAD_ROOM_WINDOW_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_IMAGE_MAX_EDGE = 1600;

export const UPLOAD_TYPE_ERROR = "That file type isn't allowed.";
export const UPLOAD_MISMATCH_ERROR = "That file doesn't match its name.";
export const UPLOAD_IMAGE_SIZE_ERROR = "Pictures need to be 4 MB or smaller.";
export const UPLOAD_FILE_SIZE_ERROR = "Files need to be 10 MB or smaller.";
export const UPLOAD_EMPTY_ERROR = "That file is empty.";
export const UPLOAD_MEMBER_LIMIT = "You've shared 5 files in the last 10 minutes. Try again later.";
export const UPLOAD_ROOM_LIMIT = "The room has hit today's upload limit. Try again tomorrow.";
export const UPLOAD_NEW_MEMBER = "New here? Uploads unlock after 10 minutes.";

const DENIED_EXTENSIONS = new Set([
  "svg",
  "html",
  "htm",
  "js",
  "mjs",
  "cjs",
  "exe",
  "msi",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "apk",
  "dmg",
  "jar",
  "zip",
  "rar",
  "7z",
  "docm",
  "xlsm",
]);

type AllowEntry = {
  kind: "image" | "file";
  extensions: readonly string[];
  types: readonly string[];
  maxBytes: number;
};

const ALLOWED: readonly AllowEntry[] = [
  { kind: "image", extensions: ["jpg", "jpeg"], types: ["image/jpeg"], maxBytes: IMAGE_MAX_BYTES },
  { kind: "image", extensions: ["png"], types: ["image/png"], maxBytes: IMAGE_MAX_BYTES },
  { kind: "image", extensions: ["webp"], types: ["image/webp"], maxBytes: IMAGE_MAX_BYTES },
  { kind: "image", extensions: ["gif"], types: ["image/gif"], maxBytes: IMAGE_MAX_BYTES },
  { kind: "file", extensions: ["pdf"], types: ["application/pdf"], maxBytes: FILE_MAX_BYTES },
  { kind: "file", extensions: ["txt"], types: ["text/plain"], maxBytes: FILE_MAX_BYTES },
  {
    kind: "file",
    extensions: ["md"],
    types: ["text/markdown", "text/plain"],
    maxBytes: FILE_MAX_BYTES,
  },
  {
    kind: "file",
    extensions: ["csv"],
    types: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"],
    maxBytes: FILE_MAX_BYTES,
  },
  { kind: "file", extensions: ["mp3"], types: ["audio/mpeg", "audio/mp3"], maxBytes: FILE_MAX_BYTES },
  {
    kind: "file",
    extensions: ["m4a"],
    types: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
    maxBytes: FILE_MAX_BYTES,
  },
  {
    kind: "file",
    extensions: ["wav"],
    types: ["audio/wav", "audio/wave", "audio/x-wav"],
    maxBytes: FILE_MAX_BYTES,
  },
  { kind: "file", extensions: ["mp4"], types: ["video/mp4"], maxBytes: FILE_MAX_BYTES },
  { kind: "file", extensions: ["mov"], types: ["video/quicktime"], maxBytes: FILE_MAX_BYTES },
  { kind: "file", extensions: ["webm"], types: ["video/webm"], maxBytes: FILE_MAX_BYTES },
];

export type UploadKind = "image" | "file";

export type UploadDecision =
  | { ok: true; kind: UploadKind; contentType: string; extension: string; maxBytes: number }
  | { ok: false; error: string };

export class UploadHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UploadHttpError";
    this.status = status;
  }
}

export function baseContentType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/** Letters, numbers, dot, underscore, and hyphen. Everything else becomes a hyphen. */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[/\\]/).pop() ?? "file").normalize("NFKC");
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "file";
}

/** Strip controls and bidi overrides so a filename can't spoof the card. */
export function displayFileName(name: string): string {
  let cleaned = "";
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;
    const control = code <= 31 || code === 127;
    const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
    if (!control && !bidi) cleaned += char;
  }
  return cleaned.trim().slice(0, 120) || "file";
}

export function classifyUpload(name: string, contentType: string, size: number): UploadDecision {
  const extension = fileExtension(name);
  if (!extension || DENIED_EXTENSIONS.has(extension)) {
    return { ok: false, error: UPLOAD_TYPE_ERROR };
  }
  const entry = ALLOWED.find((item) => item.extensions.includes(extension));
  if (!entry) return { ok: false, error: UPLOAD_TYPE_ERROR };
  const type = baseContentType(contentType);
  if (!type || !entry.types.includes(type)) return { ok: false, error: UPLOAD_MISMATCH_ERROR };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: UPLOAD_EMPTY_ERROR };
  if (size > entry.maxBytes) {
    return {
      ok: false,
      error: entry.kind === "image" ? UPLOAD_IMAGE_SIZE_ERROR : UPLOAD_FILE_SIZE_ERROR,
    };
  }
  return { ok: true, kind: entry.kind, contentType: type, extension, maxBytes: entry.maxBytes };
}

const UPLOAD_PATH = /^chat\/\d{4}-\d{2}\/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

export function isUploadPathname(pathname: string): boolean {
  return UPLOAD_PATH.test(pathname) && !pathname.includes("..");
}

export function uploadPathname(originalName: string, now = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const random = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `chat/${month}/${random}-${sanitizeFileName(originalName)}`;
}

export const UPLOAD_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  "application/pdf",
  ".pdf",
  "text/plain",
  ".txt",
  ".md",
  "text/csv",
  ".csv",
  "audio/mpeg",
  ".mp3",
  "audio/mp4",
  ".m4a",
  "audio/wav",
  ".wav",
  "video/mp4",
  ".mp4",
  "video/quicktime",
  ".mov",
  "video/webm",
  ".webm",
].join(",");

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) {
    const kb = size / 1024;
    return `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`;
  }
  const mb = size / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function mediaPlayer(contentType: string): "audio" | "video" | null {
  const type = baseContentType(contentType);
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return null;
}

/**
 * Public host for this store only. `BLOB_STORE_ID` wins; otherwise the store id
 * embedded in the read-write token (the same split `@vercel/blob` uses).
 * Never a `*.blob.vercel-storage.com` wildcard.
 */
export function blobPublicHost(input: { storeId?: string | null; token?: string | null }): string | null {
  const configured = input.storeId?.trim();
  const storeId = configured ? normalizeStoreId(configured) : storeIdFromToken(input.token);
  if (!storeId || !/^[a-z0-9]+$/i.test(storeId)) return null;
  return `${storeId}.public.blob.vercel-storage.com`;
}

function normalizeStoreId(storeId: string): string {
  return storeId.startsWith("store_") ? storeId.slice("store_".length) : storeId;
}

function storeIdFromToken(token: string | null | undefined): string {
  if (!token) return "";
  const [, , , storeId = ""] = token.trim().split("_");
  return storeId;
}

export function isTrustedBlobUrl(url: string, host: string | null): boolean {
  if (!host) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === host;
  } catch {
    return false;
  }
}

export function blobDownloadUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("download", "1");
  return parsed.toString();
}

export type UploadGate =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

export function uploadGateDecision(input: {
  signedIn: boolean;
  joined: boolean;
  rulesAccepted: boolean;
  banned: boolean;
  muted: boolean;
  joinedMs: number | null;
  nowMs: number;
  isAdmin: boolean;
}): UploadGate {
  if (!input.signedIn) return { ok: false, status: 401, error: "Unauthorized" };
  if (!input.joined || !input.rulesAccepted) {
    return { ok: false, status: 403, error: "Accept the room rules first." };
  }
  if (input.banned) return { ok: false, status: 403, error: "You can't post in the room." };
  if (input.muted) return { ok: false, status: 403, error: "You're muted." };
  const delayMs = CHAT_NEW_MEMBER_LINK_DELAY_MIN * 60_000;
  if (
    !input.isAdmin &&
    delayMs > 0 &&
    (input.joinedMs == null || input.nowMs - input.joinedMs < delayMs)
  ) {
    return { ok: false, status: 403, error: UPLOAD_NEW_MEMBER };
  }
  return { ok: true };
}

export type UploadRate =
  | { ok: true }
  | { ok: false; error: string };

export function uploadRateDecision(input: {
  mineInWindow: number;
  roomInWindow: number;
  isAdmin: boolean;
}): UploadRate {
  if (input.mineInWindow >= UPLOAD_MEMBER_MAX) return { ok: false, error: UPLOAD_MEMBER_LIMIT };
  if (!input.isAdmin && input.roomInWindow >= UPLOAD_ROOM_MAX) {
    return { ok: false, error: UPLOAD_ROOM_LIMIT };
  }
  return { ok: true };
}

/**
 * Insert only when this statement's database clock still shows room under the
 * caps. A refusal inserts nothing, so it does not consume a slot. `$8` is 1
 * for an admin (skips the room cap, not the personal one). Pass `nowExpr`
 * from tests that need a fake clock (`$9`).
 */
export function uploadInsertSql(
  dialect: "sqlite" | "postgres",
  nowExpr = dbNowSql(dialect),
): string {
  return `
insert into chat_upload (
  message_id, user_id, url, pathname, original_name, size, content_type, kind, created_ms
)
select null, $1, $2, $3, $4, $5, $6, $7, clock.now_ms
from (select ${nowExpr} as now_ms) clock
where (
  (
    select count(*) from chat_upload
    where user_id = $1
      and clock.now_ms >= created_ms
      and clock.now_ms - created_ms < ${UPLOAD_MEMBER_WINDOW_MS}
  ) < ${UPLOAD_MEMBER_MAX}
  and (
    cast($8 as integer) = 1
    or (
      select count(*) from chat_upload
      where clock.now_ms >= created_ms
        and clock.now_ms - created_ms < ${UPLOAD_ROOM_WINDOW_MS}
    ) < ${UPLOAD_ROOM_MAX}
  )
)
returning id, created_ms
`;
}

export function uploadSnapshotSql(
  dialect: "sqlite" | "postgres",
  nowExpr = dbNowSql(dialect),
): string {
  return `
select
  clock.now_ms as now_ms,
  (
    select count(*) from chat_upload
    where user_id = $1
      and clock.now_ms >= created_ms
      and clock.now_ms - created_ms < ${UPLOAD_MEMBER_WINDOW_MS}
  ) as mine_count,
  (
    select count(*) from chat_upload
    where clock.now_ms >= created_ms
      and clock.now_ms - created_ms < ${UPLOAD_ROOM_WINDOW_MS}
  ) as room_count
from (select ${nowExpr} as now_ms) clock
`;
}

/**
 * Delete blob bytes, then the caller marks those ids. A failed blob delete
 * leaves the row in place so a later delete can retry. Untrusted URLs are
 * marked without calling the blob API.
 */
export async function settleUploadDeletes(
  rows: readonly { id: number; url: string }[],
  trusted: (url: string) => boolean,
  removeBlob: (url: string) => Promise<void>,
): Promise<number[]> {
  const marked: number[] = [];
  for (const row of rows) {
    try {
      if (trusted(row.url)) await removeBlob(row.url);
      marked.push(row.id);
    } catch {
      /* leave the row so a later delete can retry the blob */
    }
  }
  return marked;
}

import {
  IMAGE_MAX_BYTES,
  UPLOAD_EMPTY_ERROR,
  UPLOAD_IMAGE_SIZE_ERROR,
  UPLOAD_MISMATCH_ERROR,
  UPLOAD_TYPE_ERROR,
  fileExtension,
  isTrustedBlobUrl,
} from "../chat/uploads.ts";

/** Public page. Linked from the Comics tile on the home page. */
export const COLLECTION_PATH = "/comic/collection";

export const COLLECTION_TITLE = "John's Comic Memorabilia Collection";

export const COLLECTION_DESCRIPTION =
  "John Mulligan's comic memorabilia, one photo to a panel. John co-hosts the SpaceBat podcast.";

export const COLLECTION_URL = "https://www.spacebatshow.net/comic/collection";

export const CAPTION_MAX = 180;

/**
 * Frame 1 ships with the site. It is not a database row, so the page still
 * has a first panel when nobody has uploaded anything.
 */
export const SEED_FRAME = {
  id: "seed",
  src: "/memorabilia/frame-01-batman-statue.jpg",
  alt: "A large blue-and-grey Batman statue on a Batcave-style base, with several small Batman busts around it, on a wooden coffee table.",
  caption: "Batman, on the Batcave base.",
  seed: true,
  width: 921,
  height: 2047,
} as const;

export type PublicFrame = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  seed: boolean;
  width?: number;
  height?: number;
};

export type StoredFrame = {
  id: number;
  src: string;
  alt: string;
  caption: string;
};

/** Local PGLite uploads, when the chat blob token is not set. */
export const LOCAL_UPLOAD_SRC = /^\/memorabilia\/uploads\/[a-f0-9]{32}\.(jpg|png|gif|webp)$/;

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

export class MemorabiliaHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MemorabiliaHttpError";
    this.status = status;
  }
}

/**
 * Same crew check as /admin: a signed-in account whose member_profile.role
 * is admin. Signed-out and listener accounts are refused before any write.
 */
export function memorabiliaAdminDecision(input: {
  signedIn: boolean;
  role: string | null | undefined;
}): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (!input.signedIn) return { ok: false, status: 401, error: "Unauthorized" };
  if (input.role !== "admin") return { ok: false, status: 403, error: "Crew only." };
  return { ok: true };
}

export function homeBeatHref(
  label: "Comics" | "Movies" | "Tech" | "Politics" | "Markets",
): "/podcast" | "/comic/collection" {
  return label === "Comics" ? "/comic/collection" : "/podcast";
}

export function cleanCaption(raw: unknown): string | { error: string } {
  if (raw == null) return "";
  if (typeof raw !== "string") return { error: "Caption needs to be text." };
  if (raw.length > 1_000) {
    return { error: `Captions need to be ${CAPTION_MAX} characters or fewer.` };
  }
  let cleaned = "";
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    const control = code <= 31 || code === 127;
    const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
    if (!control && !bidi) cleaned += char;
  }
  const trimmed = cleaned.trim();
  if (trimmed.length > CAPTION_MAX) {
    return { error: `Captions need to be ${CAPTION_MAX} characters or fewer.` };
  }
  return trimmed;
}

export function altForUpload(caption: string): string {
  return caption || "A piece from John Mulligan's comic memorabilia collection.";
}

export function sniffMemorabiliaImage(
  bytes: Uint8Array,
): { contentType: string; extension: "jpg" | "png" | "gif" | "webp" } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export type ImageDecision =
  | { ok: true; contentType: string; extension: "jpg" | "png" | "gif" | "webp" }
  | { ok: false; error: string };

export function classifyMemorabiliaImage(
  name: string,
  contentType: string,
  bytes: Uint8Array,
): ImageDecision {
  if (bytes.byteLength <= 0) return { ok: false, error: UPLOAD_EMPTY_ERROR };
  if (bytes.byteLength > IMAGE_MAX_BYTES) return { ok: false, error: UPLOAD_IMAGE_SIZE_ERROR };
  const sniffed = sniffMemorabiliaImage(bytes);
  if (!sniffed) return { ok: false, error: UPLOAD_TYPE_ERROR };
  const extension = fileExtension(name);
  if (extension && !IMAGE_EXTENSIONS.has(extension)) {
    return { ok: false, error: UPLOAD_TYPE_ERROR };
  }
  if (
    extension &&
    extension !== sniffed.extension &&
    !(sniffed.extension === "jpg" && extension === "jpeg")
  ) {
    return { ok: false, error: UPLOAD_MISMATCH_ERROR };
  }
  const declared = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (declared && declared !== "application/octet-stream" && declared !== sniffed.contentType) {
    return { ok: false, error: UPLOAD_MISMATCH_ERROR };
  }
  return { ok: true, contentType: sniffed.contentType, extension: sniffed.extension };
}

export function memorabiliaPathname(extension: string, now = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const random = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `memorabilia/${month}/${random}.${extension}`;
}

export function isSafeFrameSrc(src: string, blobHost: string | null): boolean {
  if (src === SEED_FRAME.src) return true;
  if (LOCAL_UPLOAD_SRC.test(src)) return true;
  return isTrustedBlobUrl(src, blobHost);
}

export function assembleFrames(
  rows: readonly StoredFrame[],
  blobHost: string | null,
): PublicFrame[] {
  const uploaded: PublicFrame[] = [];
  for (const row of rows) {
    if (!Number.isInteger(row.id) || row.id <= 0) continue;
    if (!isSafeFrameSrc(row.src, blobHost) || row.src === SEED_FRAME.src) continue;
    uploaded.push({
      id: String(row.id),
      src: row.src,
      alt: row.alt || altForUpload(row.caption),
      caption: row.caption,
      seed: false,
    });
  }
  return [SEED_FRAME, ...uploaded];
}

export function collectionPageModel(input: {
  rows: readonly StoredFrame[];
  signedIn: boolean;
  role: string | null;
  blobHost: string | null;
}): { frames: PublicFrame[]; canManage: boolean } {
  return {
    frames: assembleFrames(input.rows, input.blobHost),
    canManage: memorabiliaAdminDecision({ signedIn: input.signedIn, role: input.role }).ok,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Comic-page markup for the public spread. Captions and urls are escaped. */
export function renderComicSpread(frames: readonly PublicFrame[]): string {
  return frames
    .map((frame, index) => {
      const splash = index === 0 ? " comic-panel-splash" : "";
      const dims =
        frame.width && frame.height ? ` width="${frame.width}" height="${frame.height}"` : "";
      const caption = frame.caption
        ? `<figcaption class="comic-caption">${escapeHtml(frame.caption)}</figcaption>`
        : "";
      return `<figure class="comic-panel${splash}" data-testid="${index === 0 ? "comic-frame-1" : "comic-frame"}"><img src="${escapeHtml(frame.src)}" alt="${escapeHtml(frame.alt)}"${dims} loading="lazy" decoding="async" />${caption}</figure>`;
    })
    .join("");
}

export function collectionHeadMeta() {
  return {
    meta: [
      { title: `${COLLECTION_TITLE} · SpaceBat` },
      { name: "description", content: COLLECTION_DESCRIPTION },
      { name: "spacebat:og-title", content: COLLECTION_TITLE },
      { name: "spacebat:og-description", content: COLLECTION_DESCRIPTION },
      { name: "spacebat:og-image", content: SEED_FRAME.src },
      { name: "spacebat:og-image:width", content: String(SEED_FRAME.width) },
      { name: "spacebat:og-image:height", content: String(SEED_FRAME.height) },
      { name: "spacebat:og-url", content: COLLECTION_URL },
    ],
  };
}

export type StoredUpload = { url: string; pathname: string };

export async function acceptMemorabiliaUpload(input: {
  signedIn: boolean;
  role: string | null;
  name: string;
  contentType: string;
  bytes: Uint8Array;
  caption: string;
  now?: Date;
  put: (file: {
    pathname: string;
    bytes: Uint8Array;
    contentType: string;
  }) => Promise<StoredUpload>;
}): Promise<
  | { ok: true; url: string; pathname: string; alt: string; caption: string }
  | { ok: false; status: number; error: string }
> {
  const auth = memorabiliaAdminDecision({ signedIn: input.signedIn, role: input.role });
  if (!auth.ok) return auth;
  const image = classifyMemorabiliaImage(input.name, input.contentType, input.bytes);
  if (!image.ok) return { ok: false, status: 400, error: image.error };
  const caption = cleanCaption(input.caption);
  if (typeof caption !== "string") return { ok: false, status: 400, error: caption.error };
  const pathname = memorabiliaPathname(image.extension, input.now);
  try {
    const stored = await input.put({
      pathname,
      bytes: input.bytes,
      contentType: image.contentType,
    });
    return {
      ok: true,
      url: stored.url,
      pathname: stored.pathname,
      alt: altForUpload(caption),
      caption,
    };
  } catch (err) {
    if (err instanceof MemorabiliaHttpError) {
      return { ok: false, status: err.status, error: err.message };
    }
    return { ok: false, status: 500, error: "Couldn't store that picture." };
  }
}

export function authorizeFrameDelete(input: {
  signedIn: boolean;
  role: string | null;
  frameId: string;
}): { ok: true; id: number } | { ok: false; status: number; error: string } {
  const auth = memorabiliaAdminDecision({ signedIn: input.signedIn, role: input.role });
  if (!auth.ok) return auth;
  if (input.frameId === SEED_FRAME.id) {
    return { ok: false, status: 400, error: "That frame stays." };
  }
  if (!/^[1-9]\d{0,15}$/.test(input.frameId)) {
    return { ok: false, status: 400, error: "That frame isn't on the page." };
  }
  return { ok: true, id: Number(input.frameId) };
}

export function authorizeFrameMove(input: {
  signedIn: boolean;
  role: string | null;
  frameId: string;
  direction: string;
}):
  | { ok: true; id: number; direction: "earlier" | "later" }
  | { ok: false; status: number; error: string } {
  const auth = memorabiliaAdminDecision({ signedIn: input.signedIn, role: input.role });
  if (!auth.ok) return auth;
  if (input.direction !== "earlier" && input.direction !== "later") {
    return { ok: false, status: 400, error: "That frame isn't on the page." };
  }
  const target = authorizeFrameDelete({
    signedIn: true,
    role: "admin",
    frameId: input.frameId,
  });
  if (!target.ok) return target;
  return { ok: true, id: target.id, direction: input.direction };
}

/** New id order, or null when the frame is missing or already at that end. */
export function movedIds(
  ids: readonly number[],
  id: number,
  direction: "earlier" | "later",
): number[] | null {
  const index = ids.indexOf(id);
  if (index < 0) return null;
  const next = direction === "earlier" ? index - 1 : index + 1;
  if (next < 0 || next >= ids.length) return null;
  const copy = ids.slice();
  const item = copy[index];
  if (item == null) return null;
  copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

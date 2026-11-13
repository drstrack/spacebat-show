/** Auto pictures copied onto our storage. Host uploads stay on the chat 4 MB rule. */
export const TECH_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type ImageFileKind = {
  contentType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  extension: "jpg" | "png" | "gif" | "webp";
};

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const head = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!, bytes[5]!);
  return head === "GIF87a" || head === "GIF89a";
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  return riff === "RIFF" && webp === "WEBP";
}

const KINDS: Record<string, ImageFileKind & { matches: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg", matches: isJpeg },
  "image/png": { contentType: "image/png", extension: "png", matches: isPng },
  "image/gif": { contentType: "image/gif", extension: "gif", matches: isGif },
  "image/webp": { contentType: "image/webp", extension: "webp", matches: isWebp },
};

export function classifyImageBytes(
  contentType: string,
  bytes: Uint8Array,
  declaredLength: number | null,
): ({ ok: true } & ImageFileKind) | { ok: false; reason: "type" | "size" | "empty" } {
  if (declaredLength != null && (!Number.isFinite(declaredLength) || declaredLength > TECH_IMAGE_MAX_BYTES)) {
    return { ok: false, reason: "size" };
  }
  if (bytes.byteLength <= 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > TECH_IMAGE_MAX_BYTES) return { ok: false, reason: "size" };
  const raw = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const type = raw === "image/jpg" ? "image/jpeg" : raw;
  const kind = KINDS[type];
  if (!kind || !kind.matches(bytes)) return { ok: false, reason: "type" };
  return { ok: true, contentType: kind.contentType, extension: kind.extension };
}

import { sanitizeFileName, UPLOAD_IMAGE_MAX_EDGE } from "./uploads.ts";

const EXIF = [0x45, 0x78, 0x69, 0x66]; // "Exif"

export function shouldStripMetadata(contentType: string): boolean {
  const type = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return type === "image/jpeg" || type === "image/jpg" || type === "image/png";
}

export function fittedSize(
  width: number,
  height: number,
  maxEdge = UPLOAD_IMAGE_MAX_EDGE,
): { width: number; height: number } {
  const edge = Math.max(width, height);
  if (!Number.isFinite(edge) || edge <= 0) return { width: 1, height: 1 };
  if (edge <= maxEdge) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function includesExifMarker(bytes: Uint8Array): boolean {
  if (bytes.length < EXIF.length) return false;
  outer: for (let i = 0; i <= bytes.length - EXIF.length; i += 1) {
    for (let j = 0; j < EXIF.length; j += 1) {
      if (bytes[i + j] !== EXIF[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Canvas re-encode drops EXIF because the encoder must emit new bytes.
 * `decode` reports the source size. `encode` draws into a canvas of the fitted
 * size and returns those bytes. Output that still contains an Exif marker is refused.
 */
export async function reencodeRasterImage(
  source: Uint8Array,
  decode: (source: Uint8Array) => Promise<{ width: number; height: number }>,
  encode: (width: number, height: number) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const decoded = await decode(source);
  const fitted = fittedSize(decoded.width, decoded.height);
  const out = await encode(fitted.width, fitted.height);
  if (includesExifMarker(out)) throw new Error("Couldn't prepare that picture.");
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/** JPEG and PNG become WebP, at most 1600 px on the long edge. GIFs stay as they are. */
export async function stripImageFile(file: File): Promise<File> {
  if (!shouldStripMetadata(file.type)) return file;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const holder: { bitmap: ImageBitmap | null } = { bitmap: null };
  try {
    const out = await reencodeRasterImage(
      bytes,
      async (source) => {
        const bitmap = await createImageBitmap(new Blob([toArrayBuffer(source)], { type: file.type }));
        holder.bitmap = bitmap;
        return { width: bitmap.width, height: bitmap.height };
      },
      async (width, height) => {
        const bitmap = holder.bitmap;
        if (!bitmap) throw new Error("Couldn't prepare that picture.");
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Couldn't prepare that picture.");
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((next) => resolve(next), "image/webp", 0.9);
        });
        if (!blob) throw new Error("Couldn't prepare that picture.");
        return new Uint8Array(await blob.arrayBuffer());
      },
    );
    const stem = sanitizeFileName(file.name.replace(/\.[^.]+$/, "") || "picture");
    return new File([toArrayBuffer(out)], `${stem}.webp`, { type: "image/webp" });
  } finally {
    holder.bitmap?.close();
  }
}

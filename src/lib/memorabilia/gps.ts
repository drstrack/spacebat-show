/**
 * Remove GPS from a JPEG without recompressing the pixels.
 * Orientation (tag 0x0112) stays. A file with no GPS IFD is returned as-is.
 * PNG eXIf chunks are dropped the same way. Other formats are left untouched.
 */

const GPS_TAG = 0x8825;
const EXIF_SUB_IFD = 0x8769;

type Range = { start: number; end: number };

function typeSize(type: number): number {
  switch (type) {
    case 1:
    case 2:
    case 7:
      return 1;
    case 3:
      return 2;
    case 4:
    case 9:
      return 4;
    case 5:
    case 10:
      return 8;
    default:
      return 0;
  }
}

function readU16(bytes: Uint8Array, offset: number, le: boolean): number {
  if (offset + 2 > bytes.length) return 0;
  return le ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number, le: boolean): number {
  if (offset + 4 > bytes.length) return 0;
  if (le) {
    return (
      (bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)) >>>
      0
    );
  }
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function writeU16(bytes: Uint8Array, offset: number, value: number, le: boolean) {
  if (le) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
  } else {
    bytes[offset] = (value >> 8) & 0xff;
    bytes[offset + 1] = value & 0xff;
  }
}

function writeU32(bytes: Uint8Array, offset: number, value: number, le: boolean) {
  if (le) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
    bytes[offset + 2] = (value >> 16) & 0xff;
    bytes[offset + 3] = (value >> 24) & 0xff;
  } else {
    bytes[offset] = (value >> 24) & 0xff;
    bytes[offset + 1] = (value >> 16) & 0xff;
    bytes[offset + 2] = (value >> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
  }
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  return merged;
}

function mapOffset(offset: number, deleted: Range[]): number {
  let shift = 0;
  for (const range of deleted) {
    if (range.end <= offset) shift += range.end - range.start;
    else if (range.start < offset) return -1;
    else break;
  }
  return offset - shift;
}

function spliceOut(bytes: Uint8Array, deleted: Range[]): Uint8Array {
  let size = bytes.length;
  for (const range of deleted) size -= range.end - range.start;
  const out = new Uint8Array(size);
  let src = 0;
  let dst = 0;
  for (const range of deleted) {
    const chunk = range.start - src;
    out.set(bytes.subarray(src, range.start), dst);
    dst += chunk;
    src = range.end;
  }
  out.set(bytes.subarray(src), dst);
  return out;
}

function validOffset(bytes: Uint8Array, offset: number): boolean {
  return offset >= 8 && offset + 2 <= bytes.length;
}

/** TIFF inside an Exif APP1, or null when there is no GPS IFD to remove. */
function stripGpsFromTiff(tiff: Uint8Array): Uint8Array | null {
  if (tiff.length < 8) return null;
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) return null;
  if (readU16(tiff, 2, le) !== 42) return null;
  const ifd0 = readU32(tiff, 4, le);
  if (!validOffset(tiff, ifd0)) return null;
  const count = readU16(tiff, ifd0, le);
  if (count > 200 || ifd0 + 2 + count * 12 + 4 > tiff.length) return null;

  let gpsIndex = -1;
  let gpsOffset = 0;
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (readU16(tiff, entry, le) !== GPS_TAG) continue;
    gpsIndex = i;
    gpsOffset = readU32(tiff, entry + 8, le);
  }
  if (gpsIndex < 0) return null;

  const deleted: Range[] = [
    { start: ifd0 + 2 + gpsIndex * 12, end: ifd0 + 2 + gpsIndex * 12 + 12 },
  ];
  const ifd0End = ifd0 + 2 + count * 12 + 4;
  if (validOffset(tiff, gpsOffset)) {
    const gpsCount = readU16(tiff, gpsOffset, le);
    const gpsEnd = gpsOffset + 2 + gpsCount * 12 + 4;
    if (gpsCount <= 200 && gpsEnd <= tiff.length && (gpsEnd <= ifd0 || gpsOffset >= ifd0End)) {
      deleted.push({ start: gpsOffset, end: gpsEnd });
      for (let i = 0; i < gpsCount; i += 1) {
        const entry = gpsOffset + 2 + i * 12;
        const size = typeSize(readU16(tiff, entry + 2, le));
        const n = readU32(tiff, entry + 4, le);
        if (!size || n > 1_000_000) continue;
        const bytesNeeded = n * size;
        if (bytesNeeded <= 4) continue;
        const off = readU32(tiff, entry + 8, le);
        const end = off + bytesNeeded;
        if (off < 8 || end > tiff.length) continue;
        if (off < ifd0End && end > ifd0) continue;
        deleted.push({ start: off, end });
      }
    }
  }

  const merged = mergeRanges(deleted);
  const out = spliceOut(tiff, merged);

  const patchIfd = (oldIfd: number, dropGps: boolean) => {
    if (!validOffset(tiff, oldIfd)) return;
    const newIfd = mapOffset(oldIfd, merged);
    if (newIfd < 0 || newIfd + 2 > out.length) return;
    const oldCount = readU16(tiff, oldIfd, le);
    if (oldIfd + 2 + oldCount * 12 + 4 > tiff.length) return;
    let kept = 0;
    for (let i = 0; i < oldCount; i += 1) {
      const oldEntry = oldIfd + 2 + i * 12;
      const tag = readU16(tiff, oldEntry, le);
      if (dropGps && tag === GPS_TAG) continue;
      kept += 1;
      const newEntry = mapOffset(oldEntry, merged);
      if (newEntry < 0 || newEntry + 12 > out.length) continue;
      const size = typeSize(readU16(tiff, oldEntry + 2, le));
      const n = readU32(tiff, oldEntry + 4, le);
      const bytesNeeded = size * n;
      if (size && bytesNeeded > 4) {
        const valueOff = readU32(tiff, oldEntry + 8, le);
        const mapped = mapOffset(valueOff, merged);
        if (mapped >= 0) writeU32(out, newEntry + 8, mapped, le);
      }
      if (tag === EXIF_SUB_IFD) {
        const sub = readU32(tiff, oldEntry + 8, le);
        patchIfd(sub, false);
      }
    }
    writeU16(out, newIfd, kept, le);
    const oldNextPos = oldIfd + 2 + oldCount * 12;
    const newNextPos = mapOffset(oldNextPos, merged);
    const next = readU32(tiff, oldNextPos, le);
    if (newNextPos >= 0 && newNextPos + 4 <= out.length) {
      writeU32(out, newNextPos, next ? Math.max(0, mapOffset(next, merged)) : 0, le);
    }
    if (next) patchIfd(next, false);
  };

  patchIfd(ifd0, true);
  const newIfd0 = mapOffset(ifd0, merged);
  if (newIfd0 >= 0 && newIfd0 + 4 <= out.length) writeU32(out, 4, newIfd0, le);
  return out;
}

function isExifApp1(payload: Uint8Array): boolean {
  return (
    payload.length >= 6 &&
    payload[0] === 0x45 &&
    payload[1] === 0x78 &&
    payload[2] === 0x69 &&
    payload[3] === 0x66 &&
    payload[4] === 0 &&
    payload[5] === 0
  );
}

/** JPEG with GPS removed. Pixels and orientation stay. No GPS means the same bytes. */
export function stripJpegGps(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const chunks: Uint8Array[] = [input.subarray(0, 2)];
  let i = 2;
  let changed = false;
  while (i + 1 < input.length) {
    if (input[i] !== 0xff) {
      chunks.push(input.subarray(i));
      break;
    }
    let markerAt = i + 1;
    while (markerAt < input.length && input[markerAt] === 0xff) markerAt += 1;
    if (markerAt >= input.length) {
      chunks.push(input.subarray(i));
      break;
    }
    const marker = input[markerAt];
    const standalone =
      marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (standalone) {
      chunks.push(input.subarray(i, markerAt + 1));
      i = markerAt + 1;
      if (marker === 0xd9) break;
      continue;
    }
    if (marker === 0xda || markerAt + 3 > input.length) {
      chunks.push(input.subarray(i));
      break;
    }
    const length = (input[markerAt + 1] << 8) | input[markerAt + 2];
    if (length < 2 || markerAt + 1 + length > input.length) {
      chunks.push(input.subarray(i));
      break;
    }
    const segmentEnd = markerAt + 1 + length;
    if (marker === 0xe1) {
      const payload = input.subarray(markerAt + 3, segmentEnd);
      if (isExifApp1(payload)) {
        const stripped = stripGpsFromTiff(payload.subarray(6));
        if (stripped) {
          const newPayload = new Uint8Array(6 + stripped.length);
          newPayload.set(payload.subarray(0, 6), 0);
          newPayload.set(stripped, 6);
          const newLength = newPayload.length + 2;
          const pad = markerAt - i;
          const segment = new Uint8Array(pad + 1 + newLength);
          segment.set(input.subarray(i, markerAt), 0);
          segment[pad] = marker;
          segment[pad + 1] = (newLength >> 8) & 0xff;
          segment[pad + 2] = newLength & 0xff;
          segment.set(newPayload, pad + 3);
          chunks.push(segment);
          changed = true;
          i = segmentEnd;
          continue;
        }
      }
    }
    chunks.push(input.subarray(i, segmentEnd));
    i = segmentEnd;
  }
  if (!changed) return input;
  let size = 0;
  for (const chunk of chunks) size += chunk.length;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Drop a PNG eXIf chunk. Pixels stay. No eXIf chunk means the same bytes. */
export function stripPngExif(input: Uint8Array): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (input.length < 8 || sig.some((byte, index) => input[index] !== byte)) return input;
  const chunks: Uint8Array[] = [input.subarray(0, 8)];
  let i = 8;
  let changed = false;
  while (i + 12 <= input.length) {
    const length = readU32(input, i, false);
    const end = i + 12 + length;
    if (length > input.length || end > input.length) {
      chunks.push(input.subarray(i));
      break;
    }
    const type = String.fromCharCode(input[i + 4], input[i + 5], input[i + 6], input[i + 7]);
    if (type === "eXIf") changed = true;
    else chunks.push(input.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  if (!changed) return input;
  let size = 0;
  for (const chunk of chunks) size += chunk.length;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Lossless location strip. Formats we can't rewrite are returned unchanged. */
export function stripLocationMetadata(bytes: Uint8Array, contentType: string): Uint8Array {
  const type = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (type === "image/jpeg" || type === "image/jpg") return stripJpegGps(bytes);
  if (type === "image/png") return stripPngExif(bytes);
  return bytes;
}

function exifTiff(jpeg: Uint8Array): { tiff: Uint8Array; le: boolean } | null {
  let i = 2;
  while (i + 4 < jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    let markerAt = i + 1;
    while (markerAt < jpeg.length && jpeg[markerAt] === 0xff) markerAt += 1;
    if (markerAt >= jpeg.length) return null;
    const marker = jpeg[markerAt];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i = markerAt + 1;
      continue;
    }
    const length = (jpeg[markerAt + 1] << 8) | jpeg[markerAt + 2];
    if (length < 2 || markerAt + 1 + length > jpeg.length) return null;
    if (marker === 0xe1) {
      const payload = jpeg.subarray(markerAt + 3, markerAt + 1 + length);
      if (isExifApp1(payload)) {
        const tiff = payload.subarray(6);
        const le = tiff[0] === 0x49;
        return { tiff, le };
      }
    }
    i = markerAt + 1 + length;
  }
  return null;
}

export function jpegHasGps(jpeg: Uint8Array): boolean {
  const parsed = exifTiff(jpeg);
  if (!parsed) return false;
  const { tiff, le } = parsed;
  const ifd0 = readU32(tiff, 4, le);
  if (!validOffset(tiff, ifd0)) return false;
  const count = readU16(tiff, ifd0, le);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 2 > tiff.length) return false;
    if (readU16(tiff, entry, le) === GPS_TAG) return true;
  }
  return false;
}

export function jpegOrientation(jpeg: Uint8Array): number | null {
  const parsed = exifTiff(jpeg);
  if (!parsed) return null;
  const { tiff, le } = parsed;
  const ifd0 = readU32(tiff, 4, le);
  if (!validOffset(tiff, ifd0)) return null;
  const count = readU16(tiff, ifd0, le);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (readU16(tiff, entry, le) !== 0x0112) continue;
    return readU16(tiff, entry + 8, le);
  }
  return null;
}

/** Entropy-coded scan, so a GPS edit can be checked against the pixels. */
export function jpegScan(jpeg: Uint8Array): Uint8Array | null {
  let i = 2;
  while (i + 4 < jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    let markerAt = i + 1;
    while (markerAt < jpeg.length && jpeg[markerAt] === 0xff) markerAt += 1;
    if (markerAt >= jpeg.length) return null;
    const marker = jpeg[markerAt];
    if (marker === 0xda) {
      const length = (jpeg[markerAt + 1] << 8) | jpeg[markerAt + 2];
      const start = markerAt + 1 + length;
      const end = jpeg.length >= 2 && jpeg[jpeg.length - 2] === 0xff && jpeg[jpeg.length - 1] === 0xd9
        ? jpeg.length - 2
        : jpeg.length;
      if (start > end) return null;
      return jpeg.subarray(start, end);
    }
    if (marker === 0xd9) return null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i = markerAt + 1;
      continue;
    }
    const length = (jpeg[markerAt + 1] << 8) | jpeg[markerAt + 2];
    if (length < 2) return null;
    i = markerAt + 1 + length;
  }
  return null;
}

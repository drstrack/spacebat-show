import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jpegHasGps,
  jpegOrientation,
  jpegScan,
  stripJpegGps,
  stripLocationMetadata,
  stripPngExif,
} from "./gps.ts";

function u16(value: number, le: boolean): number[] {
  return le ? [value & 0xff, (value >> 8) & 0xff] : [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number, le: boolean): number[] {
  return le
    ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
    : [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function entry(tag: number, type: number, count: number, value: number, le: boolean): number[] {
  // SHORT values sit in the first two bytes of the 4-byte slot.
  const slot = type === 3 ? [...u16(value, le), 0, 0] : u32(value, le);
  return [...u16(tag, le), ...u16(type, le), ...u32(count, le), ...slot];
}

/** Little-endian Exif with orientation 6 and a GPS latitude rational. */
function gpsJpeg(le = true): Uint8Array {
  const order = le ? [0x49, 0x49] : [0x4d, 0x4d];
  const ifd0 = 8;
  const gpsIfd = ifd0 + 2 + 2 * 12 + 4;
  const rationals = gpsIfd + 2 + 2 * 12 + 4;
  const latitude = [0xa1, 0xb2, 0xc3, 0xd4, 0x11, 0x22, 0x33, 0x44];
  const tiff = [
    ...order,
    ...u16(42, le),
    ...u32(ifd0, le),
    ...u16(2, le),
    ...entry(0x0112, 3, 1, 6, le),
    ...entry(0x8825, 4, 1, gpsIfd, le),
    ...u32(0, le),
    ...u16(2, le),
    ...entry(0x0001, 2, 2, 0x004e, le),
    ...entry(0x0002, 5, 1, rationals, le),
    ...u32(0, le),
    ...latitude,
    ...u32(1, le),
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  const scan = [0xde, 0xad, 0xbe, 0xef];
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, ...scan,
    0xff, 0xd9,
  ]);
}

function orientationOnlyJpeg(): Uint8Array {
  const le = true;
  const tiff = [
    0x49, 0x49,
    ...u16(42, le),
    ...u32(8, le),
    ...u16(1, le),
    ...entry(0x0112, 3, 1, 8, le),
    ...u32(0, le),
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x01, 0x02,
    0xff, 0xd9,
  ]);
}

describe("jpeg gps strip", () => {
  it("drops the GPS IFD, keeps orientation, and leaves the scan untouched", () => {
    for (const original of [gpsJpeg(true), gpsJpeg(false)]) {
      assert.equal(jpegHasGps(original), true);
      assert.equal(jpegOrientation(original), 6);
      const stripped = stripJpegGps(original);
      assert.notEqual(stripped, original);
      assert.equal(jpegHasGps(stripped), false);
      assert.equal(jpegOrientation(stripped), 6);
      assert.deepEqual(jpegScan(stripped), jpegScan(original));
      assert.equal(stripped.includes(0xa1) && stripped.includes(0xb2), false);
      const again = stripJpegGps(stripped);
      assert.equal(again, stripped);
      assert.deepEqual(again, stripped);
    }
  });

  it("returns a JPEG with no GPS as the same bytes", () => {
    const original = orientationOnlyJpeg();
    const stripped = stripJpegGps(original);
    assert.equal(stripped, original);
    assert.equal(jpegOrientation(stripped), 8);
    assert.equal(jpegHasGps(stripped), false);
  });

  it("does not rewrite WebP, GIF, or HEIC", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03]);
    assert.equal(stripLocationMetadata(webp, "image/webp"), webp);
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    assert.equal(stripLocationMetadata(gif, "image/gif"), gif);
    const heic = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    assert.equal(stripLocationMetadata(heic, "image/heic"), heic);
  });

  it("drops a PNG eXIf chunk and leaves the other chunks", () => {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const ihdr = [0x00, 0x00, 0x00, 0x01, 0x49, 0x48, 0x44, 0x52, 0xaa, 0x00, 0x00, 0x00, 0x00];
    const exif = [0x00, 0x00, 0x00, 0x04, 0x65, 0x58, 0x49, 0x66, 0xa1, 0xb2, 0xc3, 0xd4, 0x00, 0x00, 0x00, 0x00];
    const idat = [0x00, 0x00, 0x00, 0x02, 0x49, 0x44, 0x41, 0x54, 0x11, 0x22, 0x00, 0x00, 0x00, 0x00];
    const original = new Uint8Array([...sig, ...ihdr, ...exif, ...idat]);
    const stripped = stripPngExif(original);
    assert.equal(stripped.includes(0xa1), false);
    assert.equal(stripped.includes(0xaa), true);
    assert.equal(stripped.includes(0x11), true);
    assert.equal(stripPngExif(stripped), stripped);
    assert.equal(stripLocationMetadata(original, "image/png") !== original, true);
  });
});

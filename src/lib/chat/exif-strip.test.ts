import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fittedSize, includesExifMarker, reencodeRasterImage, shouldStripMetadata } from "./exif-strip.ts";

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("exif strip", () => {
  it("re-encodes JPEG and PNG, and leaves GIFs alone", () => {
    assert.equal(shouldStripMetadata("image/jpeg"), true);
    assert.equal(shouldStripMetadata("image/png"), true);
    assert.equal(shouldStripMetadata("image/gif"), false);
    assert.equal(shouldStripMetadata("image/webp"), false);
  });

  it("fits the long edge to 1600 px", () => {
    assert.deepEqual(fittedSize(3200, 1600), { width: 1600, height: 800 });
    assert.deepEqual(fittedSize(800, 600), { width: 800, height: 600 });
  });

  it("the re-encoded output has no Exif marker", async () => {
    const source = textBytes("\xff\xd8Exif\u0000\u0000GPSLatitudeJPEG");
    assert.equal(includesExifMarker(source), true);
    let drawn: { width: number; height: number } | null = null;
    const out = await reencodeRasterImage(
      source,
      async () => ({ width: 3200, height: 1600 }),
      async (width, height) => {
        drawn = { width, height };
        return textBytes("RIFFWEBP");
      },
    );
    assert.deepEqual(drawn, { width: 1600, height: 800 });
    assert.equal(includesExifMarker(out), false);
    assert.equal(Buffer.from(out).includes(Buffer.from("GPSLatitude")), false);
    await assert.rejects(
      reencodeRasterImage(
        source,
        async () => ({ width: 10, height: 10 }),
        async () => source,
      ),
    );
  });
});

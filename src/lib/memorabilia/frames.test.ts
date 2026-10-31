import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { UPLOAD_TYPE_ERROR } from "../chat/uploads.ts";
import {
  acceptMemorabiliaUpload,
  authorizeFrameDelete,
  CAPTION_MAX,
  cleanCaption,
  collectionHeadMeta,
  collectionPageModel,
  COLLECTION_DESCRIPTION,
  COLLECTION_TITLE,
  COLLECTION_URL,
  homeBeatHref,
  MEMORABILIA_MAX_BYTES,
  MEMORABILIA_SIZE_ERROR,
  memorabiliaAdminDecision,
  memorabiliaTokenDecision,
  movedIds,
  renderComicSpread,
  SEED_FRAME,
} from "./frames.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const HOST = "abc123.public.blob.vercel-storage.com";

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

describe("memorabilia admin guard", () => {
  it("matches the /admin crew check", () => {
    assert.deepEqual(memorabiliaAdminDecision({ signedIn: false, role: "admin" }), {
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    assert.deepEqual(memorabiliaAdminDecision({ signedIn: true, role: "listener" }), {
      ok: false,
      status: 403,
      error: "Crew only.",
    });
    assert.deepEqual(memorabiliaAdminDecision({ signedIn: true, role: null }), {
      ok: false,
      status: 403,
      error: "Crew only.",
    });
    assert.deepEqual(memorabiliaAdminDecision({ signedIn: true, role: "admin" }), { ok: true });
  });

  it("does not store a picture unless the caller is an admin", async () => {
    let puts = 0;
    const put = async () => {
      puts += 1;
      return {
        url: "/memorabilia/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
        pathname: "local/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
      };
    };
    const bytes = jpegBytes();
    const listener = await acceptMemorabiliaUpload({
      signedIn: true,
      role: "listener",
      name: "statue.jpg",
      contentType: "image/jpeg",
      bytes,
      caption: "Later",
      put,
    });
    const signedOut = await acceptMemorabiliaUpload({
      signedIn: false,
      role: "admin",
      name: "statue.jpg",
      contentType: "image/jpeg",
      bytes,
      caption: "",
      put,
    });
    assert.equal(listener.ok, false);
    assert.equal(signedOut.ok, false);
    if (!listener.ok) assert.equal(listener.status, 403);
    if (!signedOut.ok) assert.equal(signedOut.status, 401);
    assert.equal(puts, 0);
  });

  it("stores an image for an admin and refuses other files before writing", async () => {
    let puts = 0;
    const put = async (file: { pathname: string; contentType: string }) => {
      puts += 1;
      assert.equal(file.contentType, "image/jpeg");
      assert.match(file.pathname, /^memorabilia\/\d{4}-\d{2}\/[a-f0-9]{32}\.jpg$/);
      return {
        url: "/memorabilia/uploads/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg",
        pathname: file.pathname,
      };
    };
    const saved = await acceptMemorabiliaUpload({
      signedIn: true,
      role: "admin",
      name: "statue.jpeg",
      contentType: "image/jpeg",
      bytes: jpegBytes(),
      caption: "  The small bust  ",
      now: new Date("2026-10-31T12:00:00Z"),
      put,
    });
    assert.equal(saved.ok, true);
    if (saved.ok) {
      assert.equal(saved.caption, "The small bust");
      assert.equal(saved.alt, "The small bust");
    }
    assert.equal(puts, 1);

    const pdf = await acceptMemorabiliaUpload({
      signedIn: true,
      role: "admin",
      name: "notes.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      caption: "",
      put,
    });
    const svg = await acceptMemorabiliaUpload({
      signedIn: true,
      role: "admin",
      name: "pic.svg",
      contentType: "image/svg+xml",
      bytes: jpegBytes(),
      caption: "",
      put,
    });
    const big = new Uint8Array(MEMORABILIA_MAX_BYTES + 1);
    const oversized = await acceptMemorabiliaUpload({
      signedIn: true,
      role: "admin",
      name: "big.jpg",
      contentType: "image/jpeg",
      bytes: big,
      caption: "",
      put,
    });
    assert.equal(pdf.ok, false);
    assert.equal(svg.ok, false);
    assert.equal(oversized.ok, false);
    if (!pdf.ok) assert.equal(pdf.error, UPLOAD_TYPE_ERROR);
    if (!svg.ok) assert.equal(svg.error, UPLOAD_TYPE_ERROR);
    if (!oversized.ok) assert.equal(oversized.error, MEMORABILIA_SIZE_ERROR);
    assert.equal(puts, 1);
  });

  it("guards the blob token route: admin only, images only, 25 MB", () => {
    const jpg = `memorabilia/2026-10/${"a".repeat(32)}.jpg`;
    const signedOut = memorabiliaTokenDecision({
      signedIn: false,
      role: "admin",
      name: "a.jpg",
      contentType: "image/jpeg",
      size: 100,
      pathname: jpg,
    });
    assert.equal(signedOut.ok, false);
    if (!signedOut.ok) assert.equal(signedOut.status, 401);
    const listener = memorabiliaTokenDecision({
      signedIn: true,
      role: "listener",
      name: "a.jpg",
      contentType: "image/jpeg",
      size: 100,
      pathname: jpg,
    });
    assert.equal(listener.ok, false);
    if (!listener.ok) assert.equal(listener.status, 403);
    const pdf = memorabiliaTokenDecision({
      signedIn: true,
      role: "admin",
      name: "notes.pdf",
      contentType: "application/pdf",
      size: 100,
      pathname: jpg,
    });
    assert.equal(pdf.ok, false);
    if (!pdf.ok) assert.equal(pdf.error, UPLOAD_TYPE_ERROR);
    const heic = memorabiliaTokenDecision({
      signedIn: true,
      role: "admin",
      name: "iphone.heic",
      contentType: "image/heic",
      size: 1000,
      pathname: `memorabilia/2026-10/${"c".repeat(32)}.heic`,
    });
    assert.equal(heic.ok, true);
    if (heic.ok) {
      assert.equal(heic.contentType, "image/heic");
      assert.equal(heic.maximumSizeInBytes, MEMORABILIA_MAX_BYTES);
    }
    const capped = memorabiliaTokenDecision({
      signedIn: true,
      role: "admin",
      name: "a.jpg",
      contentType: "image/jpeg",
      size: MEMORABILIA_MAX_BYTES,
      pathname: jpg,
    });
    assert.equal(capped.ok, true);
    if (capped.ok) assert.equal(capped.maximumSizeInBytes, 25 * 1024 * 1024);
    const over = memorabiliaTokenDecision({
      signedIn: true,
      role: "admin",
      name: "a.jpg",
      contentType: "image/jpeg",
      size: MEMORABILIA_MAX_BYTES + 1,
      pathname: jpg,
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.error, MEMORABILIA_SIZE_ERROR);
  });

  it("refuses to delete frame 1 or let a listener delete anything", () => {
    assert.equal(
      authorizeFrameDelete({ signedIn: true, role: "admin", frameId: "seed" }).ok,
      false,
    );
    const listener = authorizeFrameDelete({ signedIn: true, role: "listener", frameId: "3" });
    assert.equal(listener.ok, false);
    if (!listener.ok) assert.equal(listener.status, 403);
    const signedOut = authorizeFrameDelete({ signedIn: false, role: null, frameId: "3" });
    assert.equal(signedOut.ok, false);
    if (!signedOut.ok) assert.equal(signedOut.status, 401);
    const ok = authorizeFrameDelete({ signedIn: true, role: "admin", frameId: "3" });
    assert.deepEqual(ok, { ok: true, id: 3 });
  });
});

describe("memorabilia page", () => {
  it("renders frame 1 first, as a comic panel, with no upload controls", () => {
    const model = collectionPageModel({
      rows: [],
      signedIn: false,
      role: null,
      blobHost: null,
    });
    assert.equal(model.canManage, false);
    assert.equal(model.frames[0], SEED_FRAME);
    const html = renderComicSpread(model.frames);
    assert.match(html, /data-testid="comic-frame-1"/);
    assert.match(html, /class="comic-panel comic-panel-splash"/);
    assert.match(html, new RegExp(`src="${SEED_FRAME.src}"`));
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.match(html, new RegExp(`alt="${SEED_FRAME.alt}"`));
    assert.match(html, /Batman, on the Batcave base\./);
    assert.match(html, /width="921"/);
    assert.match(html, /height="2047"/);
    assert.match(html, new RegExp(`href="${SEED_FRAME.src}"`));
    assert.match(html, /target="_blank"/);
    assert.doesNotMatch(html, /type="file"|Add a frame|Delete/);
  });

  it("keeps frame 1 first when later frames exist and hides the desk from listeners", () => {
    const src = `https://${HOST}/memorabilia/2026-10/cccccccccccccccccccccccccccccccc.jpg`;
    const listener = collectionPageModel({
      rows: [{ id: 2, src, alt: "Bust", caption: "Bust" }],
      signedIn: true,
      role: "listener",
      blobHost: HOST,
    });
    assert.equal(listener.canManage, false);
    assert.equal(listener.frames[0].id, "seed");
    assert.equal(listener.frames[1]?.src, src);
    const admin = collectionPageModel({
      rows: [{ id: 2, src, alt: "Bust", caption: "Bust" }],
      signedIn: true,
      role: "admin",
      blobHost: HOST,
    });
    assert.equal(admin.canManage, true);
    const html = renderComicSpread(admin.frames);
    assert.match(html, /comic-frame-1/);
    assert.match(html, /Bust/);
    assert.doesNotMatch(html.split("comic-frame-1")[1] ?? "", /comic-panel-splash/);
  });

  it("drops a picture that is not on the blob host and escapes captions", () => {
    const model = collectionPageModel({
      rows: [
        { id: 9, src: "https://evil.example/a.jpg", alt: "nope", caption: "nope" },
        {
          id: 4,
          src: "/memorabilia/uploads/dddddddddddddddddddddddddddddddd.jpg",
          alt: `"><script>alert(1)</script>`,
          caption: `"><script>alert(1)</script>`,
        },
      ],
      signedIn: false,
      role: null,
      blobHost: HOST,
    });
    assert.deepEqual(
      model.frames.map((frame) => frame.id),
      ["seed", "4"],
    );
    const html = renderComicSpread(model.frames);
    assert.doesNotMatch(html, /evil\.example|<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it("ships frame 1 as the real jpeg and lists the page for sharing", () => {
    const bytes = readFileSync(join(root, "public/memorabilia/frame-01-batman-statue.jpg"));
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.equal(bytes[2], 0xff);
    const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
    assert.match(sitemap, new RegExp(COLLECTION_URL.replace(/[.]/g, "\\.")));
    const head = collectionHeadMeta();
    assert.equal(head.meta[0]?.title, `${COLLECTION_TITLE} · SpaceBat`);
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag && tag.name === "description" && tag.content === COLLECTION_DESCRIPTION,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag && tag.name === "spacebat:og-title" && tag.content === COLLECTION_TITLE,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag && tag.name === "spacebat:og-image" && tag.content === SEED_FRAME.src,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) => "name" in tag && tag.name === "spacebat:og-url" && tag.content === COLLECTION_URL,
      ),
    );
  });

  it("sends the Comics tile to the collection and leaves the other beats", () => {
    assert.equal(homeBeatHref("Comics"), "/comic/collection");
    assert.equal(homeBeatHref("Movies"), "/podcast");
    assert.equal(homeBeatHref("Markets"), "/podcast");
  });

  it("moves uploaded frames without passing the ends", () => {
    assert.deepEqual(movedIds([2, 5, 9], 5, "earlier"), [5, 2, 9]);
    assert.deepEqual(movedIds([2, 5, 9], 5, "later"), [2, 9, 5]);
    assert.equal(movedIds([2, 5], 2, "earlier"), null);
    assert.equal(movedIds([2, 5], 5, "later"), null);
  });

  it("keeps captions short", () => {
    assert.equal(cleanCaption("  hello \n there "), "hello  there");
    const long = cleanCaption("a".repeat(CAPTION_MAX + 1));
    assert.equal(typeof long === "string", false);
  });
});

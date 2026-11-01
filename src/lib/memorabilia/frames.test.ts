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
  COLLECTION_INTRO,
  COLLECTION_PAGE_TITLE,
  COLLECTION_TITLE,
  altForUpload,
  COLLECTION_URL,
  homeBeatHref,
  podcastBeatHref,
  MEMORABILIA_MAX_BYTES,
  MEMORABILIA_SIZE_ERROR,
  memorabiliaAdminDecision,
  memorabiliaFinalizeDecision,
  memorabiliaTokenDecision,
  movedIds,
  imagePixelSize,
  previousFrameFile,
  renderComicSpread,
  COLLECTION_SHARE_FALLBACK,
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

  it("guards finalize the same way: admin only, displayable image, 25 MB", () => {
    const signedOut = memorabiliaFinalizeDecision({
      signedIn: false,
      role: "admin",
      displayContentType: "image/jpeg",
      displaySize: 100,
    });
    assert.equal(signedOut.ok, false);
    if (!signedOut.ok) assert.equal(signedOut.status, 401);
    const listener = memorabiliaFinalizeDecision({
      signedIn: true,
      role: "listener",
      displayContentType: "image/jpeg",
      displaySize: 100,
    });
    assert.equal(listener.ok, false);
    if (!listener.ok) assert.equal(listener.status, 403);
    const pdf = memorabiliaFinalizeDecision({
      signedIn: true,
      role: "admin",
      displayContentType: "application/pdf",
      displaySize: 100,
    });
    assert.equal(pdf.ok, false);
    if (!pdf.ok) assert.equal(pdf.error, UPLOAD_TYPE_ERROR);
    const heicAsPanel = memorabiliaFinalizeDecision({
      signedIn: true,
      role: "admin",
      displayContentType: "image/heic",
      displaySize: 100,
    });
    assert.equal(heicAsPanel.ok, false);
    const over = memorabiliaFinalizeDecision({
      signedIn: true,
      role: "admin",
      displayContentType: "image/jpeg",
      displaySize: MEMORABILIA_MAX_BYTES + 1,
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.error, MEMORABILIA_SIZE_ERROR);
    const heicPair = memorabiliaFinalizeDecision({
      signedIn: true,
      role: "admin",
      displayContentType: "image/jpeg",
      displaySize: MEMORABILIA_MAX_BYTES,
      originalContentType: "image/heic",
      originalSize: MEMORABILIA_MAX_BYTES,
    });
    assert.equal(heicPair.ok, true);
  });

  it("lets an admin delete any saved frame and refuses everyone else", () => {
    const seed = authorizeFrameDelete({ signedIn: true, role: "admin", frameId: "seed" });
    assert.equal(seed.ok, false);
    if (!seed.ok) assert.equal(seed.status, 400);
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
  const frameOne = {
    id: 1,
    src: COLLECTION_SHARE_FALLBACK.src,
    alt: "A large blue-and-grey Batman statue on a Batcave-style base, with several small Batman busts around it, on a wooden coffee table.",
    caption: "Batman, on the Batcave base.",
    width: COLLECTION_SHARE_FALLBACK.width,
    height: COLLECTION_SHARE_FALLBACK.height,
  };

  it("renders a saved first frame as a comic panel, with no upload controls", () => {
    const model = collectionPageModel({
      rows: [frameOne],
      signedIn: false,
      role: null,
      blobHost: null,
    });
    assert.equal(model.canManage, false);
    assert.equal(model.frames[0]?.id, "1");
    assert.equal(model.frames[0]?.src, frameOne.src);
    const html = renderComicSpread(model.frames);
    assert.match(html, /data-testid="comic-frame-1"/);
    assert.match(html, /class="comic-panel comic-panel-splash"/);
    assert.match(html, new RegExp(`src="${frameOne.src}"`));
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.match(html, new RegExp(`alt="${frameOne.alt}"`));
    assert.match(html, /Batman, on the Batcave base\./);
    assert.match(html, /width="921"/);
    assert.match(html, /height="1038"/);
    assert.match(html, new RegExp(`href="${frameOne.src}"`));
    assert.match(html, /target="_blank"/);
    assert.doesNotMatch(html, /type="file"|Add a frame|Delete/);
  });

  it("shows an empty wall when no frames are stored", () => {
    const model = collectionPageModel({
      rows: [],
      signedIn: false,
      role: null,
      blobHost: null,
    });
    assert.deepEqual(model.frames, []);
    const head = collectionHeadMeta(null);
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag && tag.name === "spacebat:og-image" && tag.content === COLLECTION_SHARE_FALLBACK.src,
      ),
    );
  });

  it("keeps the first saved frame first when later frames exist and hides the desk from listeners", () => {
    const src = `https://${HOST}/memorabilia/2026-10/cccccccccccccccccccccccccccccccc.jpg`;
    const listener = collectionPageModel({
      rows: [frameOne, { id: 2, src, alt: "Bust", caption: "Bust" }],
      signedIn: true,
      role: "listener",
      blobHost: HOST,
    });
    assert.equal(listener.canManage, false);
    assert.equal(listener.frames[0]?.id, "1");
    assert.equal(listener.frames[1]?.src, src);
    const admin = collectionPageModel({
      rows: [frameOne, { id: 2, src, alt: "Bust", caption: "Bust" }],
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
      ["4"],
    );
    const html = renderComicSpread(model.frames);
    assert.doesNotMatch(html, /evil\.example|<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it("ships frame 1 as the real jpeg and lists the page for sharing", () => {
    const bytes = readFileSync(join(root, "public/memorabilia/frame-01-batman-statue-v2.jpg"));
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.equal(bytes[2], 0xff);
    assert.deepEqual(imagePixelSize(bytes, "image/jpeg"), {
      width: COLLECTION_SHARE_FALLBACK.width,
      height: COLLECTION_SHARE_FALLBACK.height,
    });
    assert.equal(previousFrameFile(COLLECTION_SHARE_FALLBACK.src, HOST), "keep");
    assert.equal(
      previousFrameFile(`https://${HOST}/memorabilia/2026-10/${"a".repeat(32)}.jpg`, HOST),
      "blob",
    );
    assert.equal(
      previousFrameFile("/memorabilia/uploads/dddddddddddddddddddddddddddddddd.jpg", HOST),
      "local",
    );
    const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
    assert.match(sitemap, new RegExp(COLLECTION_URL.replace(/[.]/g, "\\.")));
    const head = collectionHeadMeta();
    assert.equal(COLLECTION_TITLE, "John's Collection: Comic & Movie Collectibles");
    assert.equal(COLLECTION_PAGE_TITLE, "John's Collection: Comic & Movie Collectibles · SpaceBat");
    assert.equal(
      COLLECTION_DESCRIPTION,
      "John Mulligan's collection of comic and movie collectibles, one piece per panel. John co-hosts the SpaceBat podcast.",
    );
    assert.equal(
      COLLECTION_INTRO,
      "This is John Mulligan's personal collection of comic and movie collectibles. Each panel shows one piece from his shelves. Click any photo to see it full size. John co-hosts the SpaceBat podcast.",
    );
    assert.equal(
      altForUpload(""),
      "A piece from John Mulligan's collection of comic and movie collectibles.",
    );
    const title = head.meta[0];
    assert.ok(title && "title" in title);
    assert.equal(title.title, COLLECTION_PAGE_TITLE);
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag && tag.name === "description" && tag.content === COLLECTION_DESCRIPTION,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag &&
          tag.name === "spacebat:og-title" &&
          tag.content === COLLECTION_PAGE_TITLE,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag &&
          tag.name === "spacebat:og-description" &&
          tag.content === COLLECTION_DESCRIPTION,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "name" in tag &&
          tag.name === "spacebat:og-image" &&
          tag.content === COLLECTION_SHARE_FALLBACK.src,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) => "name" in tag && tag.name === "spacebat:og-url" && tag.content === COLLECTION_URL,
      ),
    );
    const replaced = collectionHeadMeta({
      src: `https://${HOST}/memorabilia/2026-10/${"b".repeat(32)}.jpg`,
      width: 640,
      height: 480,
    });
    assert.ok(
      replaced.meta.some(
        (tag) =>
          "name" in tag &&
          tag.name === "spacebat:og-image" &&
          tag.content === `https://${HOST}/memorabilia/2026-10/${"b".repeat(32)}.jpg`,
      ),
    );
    assert.ok(
      replaced.meta.some((tag) => "name" in tag && tag.name === "spacebat:og-image:width" && tag.content === "640"),
    );
    assert.ok(
      replaced.meta.some((tag) => "name" in tag && tag.name === "spacebat:og-image:height" && tag.content === "480"),
    );
  });

  it("sends the Comics tile to the collection and leaves the other beats", () => {
    assert.equal(homeBeatHref("Comics"), "/comic/collection");
    assert.equal(homeBeatHref("Movies"), "/podcast");
    assert.equal(homeBeatHref("Markets"), "/podcast");
    assert.equal(podcastBeatHref("Comics"), "/comic/collection");
    assert.equal(podcastBeatHref("Movies"), null);
    assert.equal(podcastBeatHref("Tech"), null);
    assert.equal(podcastBeatHref("Politics"), null);
    assert.equal(podcastBeatHref("Markets"), null);
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

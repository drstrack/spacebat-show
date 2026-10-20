import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  IMAGE_MAX_BYTES,
  FILE_MAX_BYTES,
  UPLOAD_FILE_SIZE_ERROR,
  UPLOAD_IMAGE_SIZE_ERROR,
  UPLOAD_MEMBER_LIMIT,
  UPLOAD_MEMBER_MAX,
  UPLOAD_MISMATCH_ERROR,
  UPLOAD_NEW_MEMBER,
  UPLOAD_ROOM_LIMIT,
  UPLOAD_ROOM_MAX,
  UPLOAD_TYPE_ERROR,
  blobPublicHost,
  classifyUpload,
  isTrustedBlobUrl,
  isUploadPathname,
  settleUploadDeletes,
  uploadGateDecision,
  uploadInsertSql,
  uploadPathname,
  uploadRateDecision,
} from "./uploads.ts";

const HOST = "abc123.public.blob.vercel-storage.com";
const INSERT = uploadInsertSql("postgres", "cast($9 as bigint)");

describe("classifyUpload", () => {
  it("allows pictures and files on the list", () => {
    assert.equal(classifyUpload("a.JPG", "image/jpeg", 100).ok, true);
    assert.equal(classifyUpload("a.png", "image/png", IMAGE_MAX_BYTES).ok, true);
    assert.equal(classifyUpload("a.webp", "image/webp", 100).ok, true);
    assert.equal(classifyUpload("a.gif", "image/gif", 100).ok, true);
    assert.equal(classifyUpload("a.pdf", "application/pdf", FILE_MAX_BYTES).ok, true);
    assert.equal(classifyUpload("a.txt", "text/plain", 20).ok, true);
    assert.equal(classifyUpload("a.md", "text/plain", 20).ok, true);
    assert.equal(classifyUpload("a.csv", "text/csv", 20).ok, true);
    assert.equal(classifyUpload("a.mp3", "audio/mpeg", 20).ok, true);
    assert.equal(classifyUpload("a.m4a", "audio/mp4", 20).ok, true);
    assert.equal(classifyUpload("a.wav", "audio/wav", 20).ok, true);
    assert.equal(classifyUpload("a.mp4", "video/mp4", 20).ok, true);
    assert.equal(classifyUpload("a.mov", "video/quicktime", 20).ok, true);
    assert.equal(classifyUpload("a.webm", "video/webm", 20).ok, true);
  });

  it("refuses svg, html, exe, and zip", () => {
    for (const name of ["pic.svg", "page.html", "page.htm", "run.exe", "files.zip"]) {
      const decision = classifyUpload(name, "application/pdf", 100);
      assert.equal(decision.ok, false);
      if (!decision.ok) assert.equal(decision.error, UPLOAD_TYPE_ERROR);
    }
  });

  it("refuses an exe renamed to pdf when the content type does not match", () => {
    const decision = classifyUpload("virus.pdf", "application/x-msdownload", 100);
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.error, UPLOAD_MISMATCH_ERROR);
    assert.equal(classifyUpload("virus.exe", "application/pdf", 100).ok, false);
  });

  it("enforces 4 MB pictures and 10 MB files", () => {
    const image = classifyUpload("a.png", "image/png", IMAGE_MAX_BYTES + 1);
    assert.equal(image.ok, false);
    if (!image.ok) assert.equal(image.error, UPLOAD_IMAGE_SIZE_ERROR);
    const file = classifyUpload("a.pdf", "application/pdf", FILE_MAX_BYTES + 1);
    assert.equal(file.ok, false);
    if (!file.ok) assert.equal(file.error, UPLOAD_FILE_SIZE_ERROR);
    assert.equal(classifyUpload("a.png", "image/png", 0).ok, false);
  });
});

describe("blob host", () => {
  it("uses the configured store id, not a wildcard", () => {
    assert.equal(blobPublicHost({ storeId: "store_abc123" }), HOST);
    assert.equal(
      blobPublicHost({ token: "vercel_blob_rw_abc123_secret" }),
      HOST,
    );
    const url = `https://${HOST}/chat/2026-10/a.png`;
    assert.equal(isTrustedBlobUrl(url, HOST), true);
    assert.equal(isTrustedBlobUrl(`https://evil.${HOST}/a.png`, HOST), false);
    assert.equal(isTrustedBlobUrl(`https://${HOST}.attacker.com/a.png`, HOST), false);
    assert.equal(isTrustedBlobUrl("http://abc123.public.blob.vercel-storage.com/a.png", HOST), false);
    assert.equal(isTrustedBlobUrl(url, null), false);
  });

  it("builds a chat pathname", () => {
    const pathname = uploadPathname("My Photo.PNG", new Date("2026-10-20T12:00:00Z"));
    assert.equal(isUploadPathname(pathname), true);
    assert.match(pathname, /^chat\/2026-10\/[a-f0-9]{16}-my-photo\.png$/);
    assert.equal(isUploadPathname("chat/2026-10/ab-photo-X7k2pQ.png"), true);
    assert.equal(isUploadPathname("chat/2026-10/../secret.png"), false);
    assert.equal(isUploadPathname("https://evil.com/chat/2026-10/a.png"), false);
  });
});

describe("upload gates and rates", () => {
  const base = {
    signedIn: true,
    joined: true,
    rulesAccepted: true,
    banned: false,
    muted: false,
    joinedMs: 0,
    nowMs: 11 * 60 * 1000,
    isAdmin: false,
  };

  it("refuses signed-out, new, muted, and banned callers", () => {
    assert.equal(uploadGateDecision({ ...base, signedIn: false }).ok, false);
    const fresh = uploadGateDecision({ ...base, joinedMs: base.nowMs - 60_000 });
    assert.equal(fresh.ok, false);
    if (!fresh.ok) assert.equal(fresh.error, UPLOAD_NEW_MEMBER);
    assert.equal(uploadGateDecision({ ...base, muted: true }).ok, false);
    assert.equal(uploadGateDecision({ ...base, banned: true }).ok, false);
    assert.equal(uploadGateDecision({ ...base, rulesAccepted: false }).ok, false);
    assert.equal(uploadGateDecision({ ...base, joinedMs: base.nowMs - 60_000, isAdmin: true }).ok, true);
    assert.equal(uploadGateDecision(base).ok, true);
  });

  it("caps a member at 5 per 10 minutes and the room at 50 per day", () => {
    assert.equal(uploadRateDecision({ mineInWindow: 4, roomInWindow: 4, isAdmin: false }).ok, true);
    const sixth = uploadRateDecision({ mineInWindow: UPLOAD_MEMBER_MAX, roomInWindow: 5, isAdmin: false });
    assert.equal(sixth.ok, false);
    if (!sixth.ok) assert.equal(sixth.error, UPLOAD_MEMBER_LIMIT);
    const room = uploadRateDecision({ mineInWindow: 0, roomInWindow: UPLOAD_ROOM_MAX, isAdmin: false });
    assert.equal(room.ok, false);
    if (!room.ok) assert.equal(room.error, UPLOAD_ROOM_LIMIT);
    assert.equal(
      uploadRateDecision({ mineInWindow: 0, roomInWindow: UPLOAD_ROOM_MAX, isAdmin: true }).ok,
      true,
    );
  });

  it("a refused upload does not consume a slot", () => {
    const times: number[] = [];
    for (let i = 0; i < UPLOAD_MEMBER_MAX; i += 1) {
      const decision = uploadRateDecision({
        mineInWindow: times.length,
        roomInWindow: times.length,
        isAdmin: false,
      });
      assert.equal(decision.ok, true);
      times.push(i);
    }
    const refused = uploadRateDecision({
      mineInWindow: times.length,
      roomInWindow: times.length,
      isAdmin: false,
    });
    assert.equal(refused.ok, false);
    assert.equal(times.length, UPLOAD_MEMBER_MAX);
  });
});

describe("upload delete", () => {
  it("admin delete removes the linked blob and keeps a failed blob for retry", async () => {
    const removed: string[] = [];
    const trusted = "https://abc123.public.blob.vercel-storage.com/chat/2026-10/a.png";
    const marked = await settleUploadDeletes(
      [
        { id: 3, url: trusted },
        { id: 4, url: "https://evil.example/a.png" },
        { id: 5, url: "https://abc123.public.blob.vercel-storage.com/chat/2026-10/b.png" },
      ],
      (url) => isTrustedBlobUrl(url, HOST),
      async (url) => {
        if (url.endsWith("/b.png")) throw new Error("blob down");
        removed.push(url);
      },
    );
    assert.deepEqual(removed, [trusted]);
    assert.deepEqual(marked, [3, 4]);
  });
});

describe("upload insert clock", () => {
  const db = new PGlite();

  after(async () => {
    await db.close();
  });

  it("stores five uploads and refuses the sixth without writing it", async () => {
    await db.exec(`
      create table chat_upload (
        id bigserial primary key,
        message_id bigint,
        user_id text not null,
        url text not null,
        pathname text not null unique,
        original_name text not null,
        size bigint not null,
        content_type text not null,
        kind text not null,
        created_ms bigint not null,
        deleted_ms bigint
      )
    `);
    const now = 1_700_000_000_000;
    for (let i = 0; i < 5; i += 1) {
      assert.equal(await attempt(db, "member", now, 0, i), true);
    }
    assert.equal(await attempt(db, "member", now, 0, 99), false);
    const kept = await db.query<{ n: string | number }>(
      "select count(*) as n from chat_upload where user_id = 'member'",
    );
    assert.equal(Number(kept.rows[0]?.n), 5);

    for (let i = 0; i < UPLOAD_ROOM_MAX; i += 1) {
      await db.query(
        `insert into chat_upload (user_id, url, pathname, original_name, size, content_type, kind, created_ms)
         values ($1, $2, $3, 'a.png', 10, 'image/png', 'image', $4)`,
        [`other-${i}`, `https://${HOST}/x`, `chat/2026-10/other-${i}.png`, now],
      );
    }
    assert.equal(await attempt(db, "listener", now, 0, 1), false);
    assert.equal(await attempt(db, "admin", now, 1, 1), true);
  });
});

async function attempt(
  db: PGlite,
  user: string,
  now: number,
  admin: number,
  n: number,
): Promise<boolean> {
  const pathname = `chat/2026-10/${user}-${n}.png`;
  const result = await db.query(
    INSERT,
    [user, `https://${HOST}/${pathname}`, pathname, "a.png", 10, "image/png", "image", admin, now],
  );
  return result.rows.length > 0;
}

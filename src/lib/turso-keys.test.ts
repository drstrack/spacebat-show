import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickTursoKeys } from "./turso-keys.ts";

describe("pickTursoKeys", () => {
  it("on preview considers only PREVIEW_ keys", () => {
    const picked = pickTursoKeys({
      VERCEL_ENV: "preview",
      TURSO_DATABASE_URL: "libsql://prod.example",
      TURSO_AUTH_TOKEN: "prod-token",
      PREVIEW_TURSO_DATABASE_URL: "libsql://preview.example",
      PREVIEW_TURSO_AUTH_TOKEN: "preview-token",
    });
    assert.deepEqual(picked, {
      urlKey: "PREVIEW_TURSO_DATABASE_URL",
      tokenKey: "PREVIEW_TURSO_AUTH_TOKEN",
    });
  });

  it("on preview does not fall through to a production key", () => {
    assert.equal(
      pickTursoKeys({
        VERCEL_ENV: "preview",
        TURSO_DATABASE_URL: "libsql://prod.example",
        SPACEBAT_TURSO_DATABASE_URL: "libsql://named.example",
      }),
      null,
    );
  });

  it("on preview still prefers a PREVIEW_ key that mentions spacebat", () => {
    const picked = pickTursoKeys({
      VERCEL_ENV: "preview",
      PREVIEW_TURSO_DATABASE_URL: "libsql://preview.example",
      PREVIEW_SPACEBAT_TURSO_DATABASE_URL: "libsql://named-preview.example",
    });
    assert.equal(picked?.urlKey, "PREVIEW_SPACEBAT_TURSO_DATABASE_URL");
    assert.equal(picked?.tokenKey, "PREVIEW_SPACEBAT_TURSO_AUTH_TOKEN");
  });

  it("on production ignores PREVIEW_ keys", () => {
    const picked = pickTursoKeys({
      VERCEL_ENV: "production",
      PREVIEW_TURSO_DATABASE_URL: "libsql://preview.example",
      PREVIEW_SPACEBAT_TURSO_DATABASE_URL: "libsql://named-preview.example",
      TURSO_DATABASE_URL: "libsql://prod.example",
    });
    assert.deepEqual(picked, {
      urlKey: "TURSO_DATABASE_URL",
      tokenKey: "TURSO_AUTH_TOKEN",
    });
  });

  it("on production returns null when the only keys are PREVIEW_", () => {
    assert.equal(
      pickTursoKeys({
        VERCEL_ENV: "production",
        PREVIEW_TURSO_DATABASE_URL: "libsql://preview.example",
      }),
      null,
    );
  });

  it("locally keeps today's preference for a spacebat key, including PREVIEW_", () => {
    const picked = pickTursoKeys({
      TURSO_DATABASE_URL: "libsql://plain.example",
      PREVIEW_SPACEBAT_TURSO_DATABASE_URL: "libsql://named.example",
    });
    assert.equal(picked?.urlKey, "PREVIEW_SPACEBAT_TURSO_DATABASE_URL");
    assert.equal(picked?.tokenKey, "PREVIEW_SPACEBAT_TURSO_AUTH_TOKEN");
  });

  it("locally uses the first Turso URL key when none mentions spacebat", () => {
    const picked = pickTursoKeys({
      TURSO_DATABASE_URL: "libsql://plain.example",
      OTHER_TURSO_DATABASE_URL: "libsql://other.example",
    });
    assert.equal(picked?.urlKey, "TURSO_DATABASE_URL");
    assert.equal(picked?.tokenKey, "TURSO_AUTH_TOKEN");
  });
});

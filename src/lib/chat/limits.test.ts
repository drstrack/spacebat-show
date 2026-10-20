import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPost,
  normalizeBody,
  retryAfterMs,
  slowDownMessage,
  slowDownSeconds,
  validateHandle,
} from "./limits.ts";

describe("validateHandle", () => {
  it("accepts a trimmed name and lowercases the key", () => {
    assert.deepEqual(validateHandle("  Cool_Bat-1. ", false), {
      ok: true,
      handle: "Cool_Bat-1.",
      handleKey: "cool_bat-1.",
    });
  });

  it("allows spaces and refuses anything outside the set", () => {
    assert.equal(validateHandle("hi there", false).ok, true);
    const bang = validateHandle("hi!", false);
    assert.equal(bang.ok, false);
    if (!bang.ok) assert.match(bang.error, /2–24/);
  });

  it("refuses fewer than 2 or more than 24 characters", () => {
    assert.equal(validateHandle("a", false).ok, false);
    assert.equal(validateHandle("  a  ", false).ok, false);
    assert.equal(validateHandle("a".repeat(24), false).ok, true);
    assert.equal(validateHandle("a".repeat(25), false).ok, false);
  });

  it("refuses @ and email-shaped names", () => {
    const at = validateHandle("dan@show", false);
    assert.equal(at.ok, false);
    if (!at.ok) assert.equal(at.error, "That name looks like an email.");
    const email = validateHandle("spacebatshow@gmail.com", true);
    assert.equal(email.ok, false);
    if (!email.ok) assert.equal(email.error, "That name looks like an email.");
  });

  it("refuses reserved names unless the caller is an admin", () => {
    for (const name of ["admin", "Mod", "SPACEBAT", "system", "dan", "John"]) {
      const refused = validateHandle(name, false);
      assert.equal(refused.ok, false, name);
      if (!refused.ok) assert.equal(refused.error, "That name is reserved.");
      assert.equal(validateHandle(name, true).ok, true, name);
    }
  });

  it("does not treat a reserved name with an extra character as reserved", () => {
    assert.equal(validateHandle("danny", false).ok, true);
    assert.equal(validateHandle("spacebat!", false).ok, false);
  });
});

describe("normalizeBody", () => {
  it("trims and collapses 3 or more blank lines into 2", () => {
    assert.deepEqual(normalizeBody("  hello \r\n\r\n\r\n\r\nthere  "), {
      ok: true,
      body: "hello \n\n\nthere",
    });
    assert.deepEqual(normalizeBody("a\n\n\n\nb"), { ok: true, body: "a\n\n\nb" });
    assert.deepEqual(normalizeBody("a\n\n\nb"), { ok: true, body: "a\n\n\nb" });
    assert.deepEqual(normalizeBody("a\n \n \n \nb"), { ok: true, body: "a\n\n\nb" });
  });

  it("leaves markup as literal text", () => {
    assert.deepEqual(normalizeBody("<b>hi</b>"), { ok: true, body: "<b>hi</b>" });
    assert.deepEqual(normalizeBody("<script>alert(1)</script>"), {
      ok: true,
      body: "<script>alert(1)</script>",
    });
  });

  it("refuses an empty body and a body over 1000 characters", () => {
    const empty = normalizeBody("   \n\n  ");
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.error, "Write a message first.");
    assert.equal(normalizeBody("x".repeat(1000)).ok, true);
    const over = normalizeBody(`  ${"x".repeat(1001)}  `);
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.error, "Keep it under 1000 characters.");
  });

  it("counts length after collapsing blank lines", () => {
    const body = `${"x".repeat(1000)}\n\n\n\n`;
    assert.equal(normalizeBody(body).ok, true);
  });
});

describe("canPost", () => {
  const now = 1_700_000_000_000;

  it("allows a first message", () => {
    assert.equal(canPost(null, 0, now), true);
  });

  it("refuses a message less than 3 seconds after the last one", () => {
    assert.equal(canPost(now - 2_999, 1, now), false);
    assert.equal(canPost(now - 3_000, 1, now), true);
  });

  it("refuses the 20th message in the last minute", () => {
    assert.equal(canPost(now - 10_000, 19, now), true);
    assert.equal(canPost(now - 10_000, 20, now), false);
    assert.equal(canPost(null, 20, now), false);
  });
});

describe("retryAfterMs", () => {
  const now = 1_700_000_000_000;

  it("allows a first post, an exact 3s gap, and a 4s gap", () => {
    assert.equal(retryAfterMs(null, [], now), null);
    assert.equal(retryAfterMs(now - 3_000, [now - 3_000], now), null);
    assert.equal(retryAfterMs(now - 4_000, [now - 4_000], now), null);
  });

  it("waits out the rest of the 3s gap", () => {
    assert.equal(retryAfterMs(now - 2_999, [now - 2_999], now), 1);
    assert.equal(slowDownMessage(1), "Slow down, you can post again in 1s");
    assert.equal(slowDownMessage(3_001), "Slow down, you can post again in 4s");
    assert.equal(slowDownSeconds("Slow down, you can post again in 4s"), 4);
    assert.equal(slowDownSeconds("Slow down a sec."), null);
  });

  it("waits until the oldest message in a full minute leaves the window", () => {
    const times = Array.from({ length: 20 }, (_, index) => now - 50_000 + index * 1_000);
    assert.equal(retryAfterMs(now - 31_000, times, now), 10_000);
    assert.equal(retryAfterMs(now - 31_000, times.slice(1), now), null);
  });
});

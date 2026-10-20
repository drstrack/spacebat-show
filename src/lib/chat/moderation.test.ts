import assert from "node:assert/strict";
import { test } from "node:test";
import { containsBlockedWord, normalizeBlockword } from "./blockwords.ts";
import { canSanction, compileReport, shouldAutoHide } from "./moderation.ts";

test("containsBlockedWord", async (t) => {
  const words = ["ass"];

  await t.test("matches a whole word, any case, with punctuation", () => {
    assert.equal(containsBlockedWord("what an ass", words), "ass");
    assert.equal(containsBlockedWord("Ass.", words), "ass");
    assert.equal(containsBlockedWord("the ASS!", words), "ass");
  });

  await t.test("does not match inside another word", () => {
    assert.equal(containsBlockedWord("classic", words), null);
    assert.equal(containsBlockedWord("a classic album", words), null);
    assert.equal(containsBlockedWord("asshole", words), null);
    assert.equal(containsBlockedWord("class", words), null);
  });

  await t.test("normalizes NFKC before matching", () => {
    assert.equal(containsBlockedWord("\uFF21ss", words), "ass");
    assert.equal(containsBlockedWord("fullwidth \uFF41\uFF53\uFF53 here", words), "ass");
  });

  await t.test("treats a newline as a boundary", () => {
    assert.equal(containsBlockedWord("hello\nass", words), "ass");
  });
});

test("normalizeBlockword", () => {
  assert.equal(normalizeBlockword("  ZorpTest "), "zorptest");
  assert.equal(normalizeBlockword("a"), null);
  assert.equal(normalizeBlockword("two words"), null);
  assert.equal(normalizeBlockword("bad!"), null);
});

test("shouldAutoHide", () => {
  assert.equal(shouldAutoHide(0), false);
  assert.equal(shouldAutoHide(2), false);
  assert.equal(shouldAutoHide(3), true);
  assert.equal(shouldAutoHide(4), true);
});

test("compileReport", () => {
  assert.deepEqual(compileReport("spam", "  "), { ok: true, stored: "spam" });
  assert.deepEqual(compileReport("other", "  sold  something "), {
    ok: true,
    stored: "other: sold something",
  });
  assert.equal(compileReport("nope", "").ok, false);
  assert.equal(compileReport("spam", "x".repeat(201)).ok, false);
});

test("canSanction", async (t) => {
  const listener = { userId: "listener", isAdmin: false };
  const admin = { userId: "admin", isAdmin: true };
  const otherAdmin = { userId: "other-admin", isAdmin: true };
  const member = { userId: "member", isAdmin: false };

  await t.test("a listener cannot sanction anyone", () => {
    assert.equal(canSanction(listener, member).ok, false);
    assert.equal(canSanction(listener, admin).ok, false);
    assert.equal(canSanction(listener, listener).ok, false);
  });

  await t.test("an admin can sanction a listener", () => {
    assert.deepEqual(canSanction(admin, member), { ok: true });
  });

  await t.test("an admin cannot sanction themselves", () => {
    const decision = canSanction(admin, admin);
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.match(decision.error, /yourself/);
  });

  await t.test("an admin cannot sanction another admin", () => {
    const decision = canSanction(admin, otherAdmin);
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.match(decision.error, /another admin/);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { placeMenuBox } from "./menu-box.ts";

const menu = { width: 160, height: 180 };
const phone = { width: 375, height: 667 };

test("menu opens below the button when there is room", () => {
  const box = placeMenuBox({ top: 120, bottom: 140, left: 24 }, menu, phone);
  assert.equal(box.left, 24);
  assert.equal(box.top, 144);
  assert.ok(box.top + menu.height < phone.height);
  assert.ok(box.left + menu.width < phone.width);
});

test("menu flips above the last message when the feed is at the bottom", () => {
  const box = placeMenuBox({ top: 560, bottom: 580, left: 24 }, menu, phone);
  assert.equal(box.top, 560 - 4 - menu.height);
  assert.ok(box.top >= 8);
  assert.ok(box.top + menu.height <= 560);
});

test("menu stays inside a 375px viewport when the button is near the right edge", () => {
  const box = placeMenuBox({ top: 200, bottom: 220, left: 300 }, menu, phone);
  assert.equal(box.left, 375 - 8 - menu.width);
  assert.ok(box.left >= 8);
  assert.ok(box.left + menu.width <= phone.width - 8);
});

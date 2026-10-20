import assert from "node:assert/strict";
import test from "node:test";
import { countUrls, isEmojiOnly, MAX_URLS_PER_MESSAGE, tokenize } from "./render.ts";

test("javascript and raw html stay plain text", () => {
  const script = tokenize("javascript:alert(1)");
  assert.deepEqual(script, [{ type: "text", value: "javascript:alert(1)" }]);
  const markup = tokenize("<img src=x onerror=alert(1)>");
  assert.deepEqual(markup, [{ type: "text", value: "<img src=x onerror=alert(1)>" }]);
});

test("a picture on an untrusted host is only a link", () => {
  const tokens = tokenize("https://example.com/a.png");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0]?.type, "link");
  if (tokens[0]?.type === "link") assert.equal(tokens[0].href, "https://example.com/a.png");
});

test("a GIPHY media URL is an inline image", () => {
  const tokens = tokenize("https://media.giphy.com/media/abc/giphy.gif");
  assert.equal(tokens[0]?.type, "image");
  if (tokens[0]?.type === "image") {
    assert.equal(tokens[0].src, "https://media.giphy.com/media/abc/giphy.gif");
  }
});

test("a giphy.com gif page becomes an i.giphy.com image", () => {
  const tokens = tokenize("https://giphy.com/gifs/funny-cat-AbC123");
  assert.equal(tokens[0]?.type, "image");
  if (tokens[0]?.type === "image") {
    assert.equal(tokens[0].src, "https://i.giphy.com/AbC123.gif");
    assert.equal(tokens[0].href, "https://giphy.com/gifs/funny-cat-AbC123");
  }
});

test("trailing punctuation stays outside the link", () => {
  const tokens = tokenize("check https://www.spacebatshow.net/podcast.");
  assert.equal(tokens[0]?.type, "text");
  assert.equal(tokens[1]?.type, "link");
  if (tokens[1]?.type === "link") {
    assert.equal(tokens[1].href, "https://www.spacebatshow.net/podcast");
  }
  assert.equal(tokens[2]?.type, "text");
  if (tokens[2]?.type === "text") assert.equal(tokens[2].value, ".");
});

test("balanced parentheses stay inside the URL", () => {
  const tokens = tokenize("see https://en.wikipedia.org/wiki/Bat_(animal) today");
  assert.equal(tokens[1]?.type, "link");
  if (tokens[1]?.type === "link") {
    assert.equal(tokens[1].href, "https://en.wikipedia.org/wiki/Bat_(animal)");
  }
});

test("the third image URL renders as a link", () => {
  const body = [
    "https://i.imgur.com/one.png",
    "https://i.imgur.com/two.jpg",
    "https://i.imgur.com/three.gif",
  ].join(" ");
  const tokens = tokenize(body);
  const images = tokens.filter((token) => token.type === "image");
  const links = tokens.filter((token) => token.type === "link");
  assert.equal(images.length, 2);
  assert.equal(links.length, 1);
  if (links[0]?.type === "link") assert.match(links[0].href, /three\.gif$/);
});

test("imgur pictures are images and other hosts stay links", () => {
  const imgur = tokenize("https://i.imgur.com/bat.png");
  assert.equal(imgur[0]?.type, "image");
  const other = tokenize("https://random-site.com/x.png");
  assert.equal(other[0]?.type, "link");
});

test("emoji-only messages are one to three emoji", () => {
  assert.equal(isEmojiOnly("🦇🚀"), true);
  assert.equal(isEmojiOnly("🦇"), true);
  assert.equal(isEmojiOnly("😀😁😂"), true);
  assert.equal(isEmojiOnly("😀😁😂🤣"), false);
  assert.equal(isEmojiOnly("hello 🦇"), false);
  assert.equal(isEmojiOnly("https://example.com"), false);
});

test("more than five URLs is over the limit", () => {
  const urls = Array.from({ length: 6 }, (_, index) => `https://example.com/${index}`).join(" ");
  assert.equal(countUrls(urls) > MAX_URLS_PER_MESSAGE, true);
  assert.equal(countUrls("https://example.com https://i.imgur.com/a.png"), 2);
});

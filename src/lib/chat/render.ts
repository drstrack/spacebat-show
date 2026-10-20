export const CHAT_NEW_MEMBER_LINK_DELAY_MIN = 10;
export const MAX_URLS_PER_MESSAGE = 5;

const IMAGE_HOSTS = new Set([
  "i.giphy.com",
  "media.giphy.com",
  "media.tenor.com",
  "i.imgur.com",
  "www.spacebatshow.net",
  "assets.podhome.fm",
]);

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>]+/gi;
const TRAILING = new Set([".", ",", "!", "?", ")", "]", "}", "'", '"']);
const IMAGE_EXT = /\.(?:gif|png|jpe?g|webp)$/i;
const EMOJI_SEQUENCE =
  /\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\uFE0E)?)*/gu;

export type ChatToken =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string }
  | { type: "image"; src: string; href: string; alt: string; giphy: boolean };

export function tokenize(body: string): ChatToken[] {
  const tokens: ChatToken[] = [];
  let cursor = 0;
  let images = 0;
  for (const match of body.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (start > cursor) tokens.push({ type: "text", value: body.slice(cursor, start) });
    const { url, suffix } = trimTrailing(raw);
    const token = classify(url);
    if (!token) {
      tokens.push({ type: "text", value: raw });
    } else {
      if (token.type === "image") {
        images += 1;
        tokens.push(
          images > 2 ? { type: "link", href: token.href, label: labelFor(token.href) } : token,
        );
      } else {
        tokens.push(token);
      }
      if (suffix) tokens.push({ type: "text", value: suffix });
    }
    cursor = start + raw.length;
  }
  if (cursor < body.length) tokens.push({ type: "text", value: body.slice(cursor) });
  return mergeText(tokens);
}

export function countUrls(body: string): number {
  return tokenize(body).filter((token) => token.type !== "text").length;
}

/** One to three emoji, and nothing else, render larger. */
export function isEmojiOnly(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  const matches = trimmed.match(EMOJI_SEQUENCE);
  if (!matches || matches.length < 1 || matches.length > 3) return false;
  const rest = trimmed
    .replace(EMOJI_SEQUENCE, "")
    .replace(/\s/g, "")
    .replace(/\u200d/g, "")
    .replace(/\uFE0F/g, "")
    .replace(/\uFE0E/g, "");
  return rest.length === 0;
}

function mergeText(tokens: ChatToken[]): ChatToken[] {
  const merged: ChatToken[] = [];
  for (const token of tokens) {
    const prev = merged[merged.length - 1];
    if (token.type === "text" && prev?.type === "text") prev.value += token.value;
    else if (token.type !== "text" || token.value) merged.push(token);
  }
  return merged;
}

function trimTrailing(raw: string): { url: string; suffix: string } {
  let end = raw.length;
  while (end > 0 && TRAILING.has(raw[end - 1] ?? "")) {
    const ch = raw[end - 1] ?? "";
    const slice = raw.slice(0, end);
    if (ch === ")" && countChar(slice, "(") === countChar(slice, ")")) break;
    if (ch === "]" && countChar(slice, "[") === countChar(slice, "]")) break;
    if (ch === "}" && countChar(slice, "{") === countChar(slice, "}")) break;
    if ((ch === "'" || ch === '"') && countChar(slice, ch) % 2 === 0) break;
    end -= 1;
  }
  return { url: raw.slice(0, end), suffix: raw.slice(end) };
}

function countChar(value: string, ch: string): number {
  let n = 0;
  for (const item of value) if (item === ch) n += 1;
  return n;
}

function classify(rawUrl: string): ChatToken | null {
  if (!rawUrl) return null;
  const withScheme = /^www\./i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const href = parsed.href;
  const src = imageSource(parsed);
  if (src) {
    let host = parsed.hostname;
    try {
      host = new URL(src).hostname;
    } catch {
      host = parsed.hostname;
    }
    return { type: "image", src, href, alt: `Image from ${host}`, giphy: isGiphyHost(host) };
  }
  return { type: "link", href, label: labelFor(href) };
}

function imageSource(url: URL): string | null {
  if (url.protocol !== "https:") return null;
  const pageId = giphyPageId(url);
  if (pageId) return `https://i.giphy.com/${pageId}.gif`;
  if (!isImageHost(url.hostname)) return null;
  if (IMAGE_EXT.test(url.pathname) || isGiphyMediaPath(url)) return url.href;
  return null;
}

function giphyPageId(url: URL): string | null {
  const host = url.hostname;
  if (host !== "giphy.com" && host !== "www.giphy.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "gifs" || !parts[1]) return null;
  const id = parts[1].split("-").pop() ?? "";
  return /^[A-Za-z0-9]+$/.test(id) ? id : null;
}

function isImageHost(host: string): boolean {
  return IMAGE_HOSTS.has(host) || /^media[0-4]\.giphy\.com$/.test(host);
}

function isGiphyHost(host: string): boolean {
  return (
    host === "i.giphy.com" ||
    host === "media.giphy.com" ||
    host === "giphy.com" ||
    host === "www.giphy.com" ||
    /^media[0-4]\.giphy\.com$/.test(host)
  );
}

function isGiphyMediaPath(url: URL): boolean {
  if (!isGiphyHost(url.hostname)) return false;
  return /\/giphy(?:\.gif)?$/i.test(url.pathname) || /^\/media\/[^/]+\/[^/]+/i.test(url.pathname);
}

function labelFor(href: string): string {
  const bare = href.replace(/^https?:\/\//i, "");
  if (bare.length <= 60) return bare;
  return `${bare.slice(0, 59)}…`;
}

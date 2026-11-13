import { youtubeVideoId, type LinkPreview } from "./link-urls.ts";

export const PREVIEW_MAX_BYTES = 512 * 1024;
export const PREVIEW_MAX_REDIRECTS = 3;
export const PREVIEW_TIMEOUT_MS = 5_000;
export const PREVIEW_FETCH_LIMIT = 60;
export const PREVIEW_WINDOW_MS = 60_000;

const TITLE_MAX = 180;
const DESCRIPTION_MAX = 280;
const SITE_MAX = 80;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export type PreviewAddress = { address: string; family: 4 | 6 };

export type PreviewLookup = (hostname: string, signal: AbortSignal) => Promise<PreviewAddress[]>;

export type PreviewResponse = {
  status: number;
  location: string | null;
  contentType: string;
  body: Uint8Array;
};

export type PreviewRequest = (input: {
  url: URL;
  address: string;
  family: 4 | 6;
  accept: string;
  signal: AbortSignal;
  /** Defaults to {@link PREVIEW_MAX_BYTES}. Chat previews do not pass this. */
  maxBytes?: number;
}) => Promise<PreviewResponse>;

export type PreviewDeps = {
  lookup: PreviewLookup;
  request: PreviewRequest;
};

type V4Block = [number, number];

const V4_BLOCKS: V4Block[] = [
  [v4(0, 0, 0, 0), 8],
  [v4(10, 0, 0, 0), 8],
  [v4(100, 64, 0, 0), 10],
  [v4(127, 0, 0, 0), 8],
  [v4(169, 254, 0, 0), 16],
  [v4(172, 16, 0, 0), 12],
  [v4(192, 0, 0, 0), 24],
  [v4(192, 0, 2, 0), 24],
  [v4(192, 168, 0, 0), 16],
  [v4(198, 18, 0, 0), 15],
  [v4(198, 51, 100, 0), 24],
  [v4(203, 0, 113, 0), 24],
  [v4(224, 0, 0, 0), 4],
  [v4(240, 0, 0, 0), 4],
];

function v4(a: number, b: number, c: number, d: number): number {
  return (((a << 24) >>> 0) + (b << 16) + (c << 8) + d) >>> 0;
}

function inV4Cidr(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value * 256 + octet) >>> 0;
  }
  return value;
}

function blockedV4(ip: number): boolean {
  return V4_BLOCKS.some(([base, bits]) => inV4Cidr(ip, base, bits));
}

/** Expand an IPv6 address to eight groups, or null when it isn't one. */
function expandIPv6(ip: string): number[] | null {
  let value = ip.toLowerCase();
  const dotted = /:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (dotted?.[1]) {
    const packed = ipv4ToInt(dotted[1]);
    if (packed == null) return null;
    const hi = (packed >>> 16).toString(16);
    const lo = (packed & 0xffff).toString(16);
    value = `${value.slice(0, dotted.index)}:${hi}:${lo}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 0) return null;
  const groups = [...left, ...Array<string>(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  const numbers: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    numbers.push(Number.parseInt(group, 16));
  }
  return numbers;
}

function blockedV6(groups: number[]): boolean {
  if (groups.every((group) => group === 0)) return true;
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0) {
    if (groups[5] === 0xffff) return blockedV4(((groups[6] << 16) | groups[7]) >>> 0);
    if (groups[5] === 0) return blockedV4(((groups[6] << 16) | groups[7]) >>> 0);
  }
  // 6to4 embeds an IPv4 address. The prefix is obsolete; refuse all of it.
  if (groups[0] === 0x2002) return true;
  // NAT64 well-known prefix. Allow it only when the embedded IPv4 is public.
  if (
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0
  ) {
    return blockedV4(((groups[6] << 16) | groups[7]) >>> 0);
  }
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xffc0) === 0xfec0) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
  if (groups[0] === 0x0100 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0) return true;
  return false;
}

/**
 * True for loopback, private, link-local, multicast, reserved, and metadata
 * addresses, including IPv4-mapped and NAT64 forms. Unparseable input is blocked.
 */
export function isBlockedIp(ip: string): boolean {
  const bare = bareHostname(ip);
  const v4Address = ipv4ToInt(bare);
  if (v4Address != null) return blockedV4(v4Address);
  const groups = expandIPv6(bare);
  if (!groups) return true;
  return blockedV6(groups);
}

/** Hostname with brackets and a trailing dot removed. */
export function bareHostname(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  while (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

/** Names that must not be resolved: localhost, single-label, and metadata hosts. */
export function isBlockedHostname(hostname: string): boolean {
  const host = bareHostname(hostname);
  if (!host || host.length > 253) return true;
  if (looksLikeIp(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".localdomain")) return true;
  if (host.endsWith(".internal") || host.endsWith(".intranet")) return true;
  if (host === "metadata" || host.endsWith(".google.internal")) return true;
  if (host === "instance-data" || host.endsWith(".instance-data")) return true;
  if (!host.includes(".")) return true;
  if (host.includes("%") || host.includes("\\") || host.includes("@")) return true;
  return false;
}

function looksLikeIp(host: string): boolean {
  return host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isObfuscatedIp(host: string): boolean {
  if (looksLikeIp(host)) return false;
  if (/^\d+$/.test(host)) return true;
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  const labels = host.split(".");
  if (labels.length === 0 || labels.length > 4) return false;
  return labels.some((label) => /^0x[0-9a-f]+$/i.test(label) || /^0[0-7]+$/.test(label));
}

export function isAllowedPreviewPort(url: URL): boolean {
  if (url.protocol === "http:") return url.port === "" || url.port === "80";
  if (url.protocol === "https:") return url.port === "" || url.port === "443";
  return false;
}

/**
 * An http(s) URL with no userinfo, only port 80/443, and a host that is not
 * an obvious internal name or a blocked IP literal. DNS is not consulted.
 */
export function publicHttpUrl(raw: string): URL | null {
  if (raw.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!isAllowedPreviewPort(url)) return null;
  const host = bareHostname(url.hostname);
  if (!host || isBlockedHostname(host) || isObfuscatedIp(host)) return null;
  if (looksLikeIp(host) && isBlockedIp(host)) return null;
  if (url.hostname.endsWith(".")) {
    try {
      url.hostname = host;
    } catch {
      return null;
    }
  }
  url.hash = "";
  if (url.href.length > 2000) return null;
  return url;
}

/** Cache key for a public URL. YouTube links share one watch URL. */
export function previewKey(raw: string): string | null {
  const id = youtubeVideoId(raw);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  const url = publicHttpUrl(raw);
  return url ? url.href : null;
}

export function isHtmlContentType(contentType: string): boolean {
  return contentType.split(";")[0]?.trim().toLowerCase() === "text/html";
}

export function isJsonContentType(contentType: string): boolean {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "application/json" || mime === "text/json";
}

/** http(s) image URL on a public host, resolved against the page when relative. */
export function safeImageUrl(raw: string, base: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  let absolute: URL;
  try {
    absolute = new URL(trimmed, base);
  } catch {
    return null;
  }
  return publicHttpUrl(absolute.href)?.href ?? null;
}

function codePoint(code: number): string | null {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return null;
  if (code >= 0xd800 && code <= 0xdfff) return null;
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) return codePoint(Number.parseInt(lower.slice(2), 16)) ?? entity;
    if (lower.startsWith("#")) return codePoint(Number.parseInt(lower.slice(1), 10)) ?? entity;
    return NAMED_ENTITIES[lower] ?? entity;
  });
}

function isControl(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code <= 31 || code === 127;
}

/** Tags removed, entities decoded once, control characters flattened. */
export function sanitizePreviewText(raw: string, max: number): string {
  const stripped = raw.replace(/<[^>]*>/g, " ");
  const decoded = decodeEntities(stripped).replace(/<[^>]*>/g, " ");
  let flat = "";
  for (const ch of decoded) flat += isControl(ch) ? " " : ch;
  return flat.replace(/\s+/g, " ").trim().slice(0, max);
}

function displayHost(pageUrl: string): string {
  try {
    return bareHostname(new URL(pageUrl).hostname).replace(/^www\./, "");
  } catch {
    return "";
  }
}

function stripEmbedded(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
}

function tagEnd(html: string, start: number): number {
  let quote: string | null = null;
  for (let index = start; index < html.length; index += 1) {
    const ch = html[index];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return index;
  }
  return -1;
}

function metaTags(html: string): string[] {
  const tags: string[] = [];
  const lower = html.toLowerCase();
  let from = 0;
  while (from < html.length) {
    const start = lower.indexOf("<meta", from);
    if (start < 0) break;
    const next = html[start + 5];
    if (next && !/[\s/>]/.test(next)) {
      from = start + 5;
      continue;
    }
    const end = tagEnd(html, start);
    if (end < 0) break;
    tags.push(html.slice(start, end + 1));
    from = end + 1;
  }
  return tags;
}

function attributes(tag: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /([^\s="'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(re)) {
    const name = match[1]?.toLowerCase();
    if (!name || map.has(name)) continue;
    map.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return map;
}

function pickMeta(tags: string[], keys: readonly string[]): string {
  const wanted = new Set(keys);
  for (const key of wanted) {
    for (const tag of tags) {
      const attrs = attributes(tag);
      const name = (attrs.get("property") || attrs.get("name") || "").toLowerCase();
      if (name !== key) continue;
      const content = attrs.get("content");
      if (content && content.trim()) return content;
    }
  }
  return "";
}

function readTitle(html: string): string {
  const match = /<title\b[^>]*>([\s\S]{0,500}?)<\/title>/i.exec(html);
  return match?.[1] ?? "";
}

export function previewFromHtml(html: string, pageUrl: string): LinkPreview | null {
  const visible = stripEmbedded(html);
  const tags = metaTags(visible);
  const title = sanitizePreviewText(
    pickMeta(tags, ["og:title", "twitter:title"]) || readTitle(visible),
    TITLE_MAX,
  );
  const description = sanitizePreviewText(
    pickMeta(tags, ["og:description", "twitter:description", "description"]),
    DESCRIPTION_MAX,
  );
  const siteName =
    sanitizePreviewText(pickMeta(tags, ["og:site_name"]), SITE_MAX) || displayHost(pageUrl);
  const image = safeImageUrl(
    pickMeta(tags, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]),
    pageUrl,
  );
  if (!title && !description && !image) return null;
  return { siteName: siteName || "Link", title, description, image };
}

export function previewFromYoutubeOembed(body: string, pageUrl: string): LinkPreview | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const title = sanitizePreviewText(
    typeof record.title === "string" ? record.title : "",
    TITLE_MAX,
  );
  const author = sanitizePreviewText(
    typeof record.author_name === "string" ? record.author_name : "",
    SITE_MAX,
  );
  const provider =
    sanitizePreviewText(
      typeof record.provider_name === "string" ? record.provider_name : "",
      SITE_MAX,
    ) || "YouTube";
  const image = safeImageUrl(
    typeof record.thumbnail_url === "string" ? record.thumbnail_url : "",
    pageUrl,
  );
  if (!title && !image) return null;
  return {
    siteName: provider,
    title,
    description: author && author !== title ? author : "",
    image,
  };
}

function youtubeOembedUrl(id: string): URL | null {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("format", "json");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
  return publicHttpUrl(url.href);
}

function decodeBody(body: Uint8Array, contentType: string): string {
  const match = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType);
  const name = match?.[1]?.toLowerCase() ?? "utf-8";
  const charset =
    name === "utf8" ? "utf-8" : name === "latin1" || name === "iso-8859-1" ? "windows-1252" : name;
  try {
    return new TextDecoder(charset, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

function clipBody(body: Uint8Array, maxBytes = PREVIEW_MAX_BYTES): Uint8Array {
  return body.byteLength > maxBytes ? body.subarray(0, maxBytes) : body;
}

async function resolvedAddress(
  url: URL,
  lookup: PreviewLookup,
  signal: AbortSignal,
): Promise<PreviewAddress | null> {
  const host = bareHostname(url.hostname);
  if (looksLikeIp(host)) {
    if (isBlockedIp(host)) return null;
    return { address: host, family: host.includes(":") ? 6 : 4 };
  }
  let records: PreviewAddress[];
  try {
    records = await lookup(host, signal);
  } catch {
    return null;
  }
  if (records.length === 0) return null;
  for (const record of records) {
    if ((record.family !== 4 && record.family !== 6) || isBlockedIp(record.address)) return null;
  }
  return records[0] ?? null;
}

function redirectTarget(current: URL, location: string): URL | null {
  const trimmed = location.trim();
  if (!trimmed || trimmed.length > 2000 || trimmed.includes("\\") || [...trimmed].some(isControl)) {
    return null;
  }
  try {
    return publicHttpUrl(new URL(trimmed, current).href);
  } catch {
    return null;
  }
}

async function follow(
  initial: URL,
  deps: PreviewDeps,
  signal: AbortSignal,
  accept: string,
  maxBytes = PREVIEW_MAX_BYTES,
): Promise<{ url: URL; contentType: string; body: Uint8Array } | null> {
  let current = initial;
  let redirects = 0;
  const seen = new Set<string>();
  while (!signal.aborted) {
    if (seen.has(current.href)) return null;
    seen.add(current.href);
    const safe = publicHttpUrl(current.href);
    if (!safe) return null;
    current = safe;
    const address = await resolvedAddress(current, deps.lookup, signal);
    if (!address || signal.aborted) return null;
    const response = await deps.request({
      url: current,
      address: address.address,
      family: address.family,
      accept,
      signal,
      maxBytes,
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= PREVIEW_MAX_REDIRECTS || !response.location) return null;
      const next = redirectTarget(current, response.location);
      if (!next) return null;
      redirects += 1;
      current = next;
      continue;
    }
    if (response.status < 200 || response.status >= 300) return null;
    return { url: current, contentType: response.contentType, body: clipBody(response.body, maxBytes) };
  }
  return null;
}

/**
 * Fetch one public page, following at most three redirects and re-checking
 * each hop. Returns null when the target is unsafe, the body isn't the
 * expected document, or the fetch fails.
 */
export async function resolveLinkPreview(
  rawUrl: string,
  deps: PreviewDeps,
  signal: AbortSignal,
): Promise<LinkPreview | null> {
  try {
    const videoId = youtubeVideoId(rawUrl);
    if (videoId) {
      const oembed = youtubeOembedUrl(videoId);
      if (!oembed) return null;
      const final = await follow(oembed, deps, signal, "application/json");
      if (!final || !isJsonContentType(final.contentType)) return null;
      const text = decodeBody(final.body, final.contentType).replace(/^\uFEFF/, "");
      return previewFromYoutubeOembed(text, `https://www.youtube.com/watch?v=${videoId}`);
    }
    const page = publicHttpUrl(rawUrl);
    if (!page) return null;
    const final = await follow(page, deps, signal, "text/html, */*;q=0.1");
    if (!final || !isHtmlContentType(final.contentType)) return null;
    const html = decodeBody(final.body, final.contentType).replace(/^\uFEFF/, "");
    return previewFromHtml(html, final.url.href);
  } catch {
    return null;
  }
}

/**
 * Fetch one public URL with the same DNS pin, redirect limit, and address
 * checks as a chat link preview. `maxBytes` defaults to the preview cap.
 * Returns null when the target is unsafe or the fetch fails. Chat previews
 * do not call this.
 */
export async function fetchPublicDocument(
  rawUrl: string,
  deps: PreviewDeps,
  signal: AbortSignal,
  options?: { accept?: string; maxBytes?: number },
): Promise<{ url: string; contentType: string; body: Uint8Array } | null> {
  try {
    const page = publicHttpUrl(rawUrl);
    if (!page) return null;
    const final = await follow(
      page,
      deps,
      signal,
      options?.accept ?? "text/html,application/xhtml+xml,*/*;q=0.1",
      options?.maxBytes ?? PREVIEW_MAX_BYTES,
    );
    if (!final) return null;
    return { url: final.url.href, contentType: final.contentType, body: final.body };
  } catch {
    return null;
  }
}

/** Per-user fetch budget. Cache hits should not call this. */
export function consumePreviewBudget(
  stamps: readonly number[],
  now: number,
  limit = PREVIEW_FETCH_LIMIT,
  windowMs = PREVIEW_WINDOW_MS,
): { allowed: boolean; stamps: number[] } {
  const recent = stamps.filter((at) => now >= at && now - at < windowMs);
  if (recent.length >= limit) return { allowed: false, stamps: recent };
  return { allowed: true, stamps: [...recent, now] };
}

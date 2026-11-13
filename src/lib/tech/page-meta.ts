export type PageMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeChar(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeChar(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function safeChar(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
  if (code <= 31 || code === 127) return "";
  return String.fromCodePoint(code);
}

function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:@a-zA-Z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(re)) {
    const key = match[1]?.toLowerCase();
    if (!key) continue;
    attrs[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return attrs;
}

export function resolveHttpUrl(value: string, base: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^data:/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function metaContent(tag: string, keys: readonly string[]): string | null {
  const attrs = attributes(tag);
  const name = (attrs.property || attrs.name || "").toLowerCase();
  if (!keys.includes(name)) return null;
  return attrs.content || null;
}

function isProductType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some((item) => {
    if (typeof item !== "string") return false;
    const name = item.trim().toLowerCase();
    return name === "product" || name.endsWith("/product");
  });
}

function collectImageValues(value: unknown, base: string, out: string[], depth: number): void {
  if (depth > 6 || out.length > 4) return;
  if (typeof value === "string") {
    const url = resolveHttpUrl(value, base);
    if (url) out.push(url);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageValues(item, base, out, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  if (typeof row.url === "string") collectImageValues(row.url, base, out, depth + 1);
  else if (typeof row.contentUrl === "string") collectImageValues(row.contentUrl, base, out, depth + 1);
  else if (typeof row["@id"] === "string" && /^https?:/i.test(row["@id"])) {
    collectImageValues(row["@id"], base, out, depth + 1);
  }
}

function walkProducts(value: unknown, base: string, out: string[], depth: number): void {
  if (depth > 8 || out.length > 0) return;
  if (Array.isArray(value)) {
    for (const item of value) walkProducts(item, base, out, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  if (isProductType(row["@type"])) collectImageValues(row.image, base, out, 0);
  if (out.length > 0) return;
  for (const child of Object.values(row)) {
    if (child && typeof child === "object") walkProducts(child, base, out, depth + 1);
    if (out.length > 0) return;
  }
}

function productImage(html: string, base: string): string | null {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const attrs = attributes(match[1] ?? "");
    const type = (attrs.type || "").toLowerCase();
    if (type !== "application/ld+json") continue;
    try {
      const parsed = JSON.parse(match[2] ?? "") as unknown;
      const found: string[] = [];
      walkProducts(parsed, base, found, 0);
      if (found[0]) return found[0];
    } catch {
      // A broken script is skipped. The next one can still hold a Product.
    }
  }
  return null;
}

type IconCandidate = { url: string; size: number; touch: boolean; index: number };

function iconSize(sizes: string | undefined, touch: boolean): number {
  if (!sizes) return touch ? 180 : 16;
  if (/\bany\b/i.test(sizes)) return 192;
  let best = 0;
  for (const match of sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi)) {
    best = Math.max(best, Number(match[1]), Number(match[2]));
  }
  if (best > 0) return best;
  return touch ? 180 : 16;
}

function largestIcon(html: string, base: string): string | null {
  const candidates: IconCandidate[] = [];
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  tags.forEach((tag, index) => {
    const attrs = attributes(tag);
    const rel = (attrs.rel || "").toLowerCase().split(/\s+/);
    const touch = rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed");
    const icon = rel.includes("icon") || rel.includes("shortcut");
    if (!touch && !icon) return;
    const type = (attrs.type || "").toLowerCase();
    const href = attrs.href || "";
    if (!href || type === "image/svg+xml" || /\.svg(?:$|\?)/i.test(href)) return;
    const url = resolveHttpUrl(href, base);
    if (!url) return;
    candidates.push({ url, size: iconSize(attrs.sizes, touch), touch, index });
  });
  candidates.sort((a, b) => b.size - a.size || Number(b.touch) - Number(a.touch) || a.index - b.index);
  return candidates[0]?.url ?? null;
}

/**
 * Picture order: og:image, twitter:image, schema.org Product image, then the
 * largest apple-touch-icon or icon. Title and description come from Open Graph
 * only, and only the caller fills them into empty fields.
 */
export function readPageMeta(html: string, baseUrl: string): PageMeta {
  let base = baseUrl;
  try {
    base = new URL(baseUrl).toString();
  } catch {
    return { title: null, description: null, imageUrl: null };
  }
  let title: string | null = null;
  let description: string | null = null;
  let ogImage: string | null = null;
  let twitterImage: string | null = null;
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!title) title = metaContent(tag, ["og:title"]);
    if (!description) description = metaContent(tag, ["og:description"]);
    if (!ogImage) {
      const content = metaContent(tag, ["og:image"]);
      if (content) ogImage = resolveHttpUrl(content, base);
    }
    if (!twitterImage) {
      const content = metaContent(tag, ["twitter:image"]);
      if (content) twitterImage = resolveHttpUrl(content, base);
    }
  }
  const imageUrl = ogImage || twitterImage || productImage(html, base) || largestIcon(html, base);
  return {
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 2000) : null,
    imageUrl,
  };
}

/** Pure Podhome schedule rules for podcast-alert mail. No database. */

const NY = "America/New_York";
const STREAM_HOST = "stream.podhome.fm";

export type ScheduledShow = {
  id: string;
  title: string;
  start: string;
};

export type PostedShow = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
};

export function parseScheduledShows(xml: string): ScheduledShow[] {
  const shows: ScheduledShow[] = [];
  for (const block of collect(xml, "podcast:liveItem")) {
    const open = block.match(/<podcast:liveItem\b[^>]*>/i)?.[0] ?? "";
    if (!/status="pending"/i.test(open)) continue;
    const start = attr(open, "start");
    const when = new Date(start);
    if (!start || Number.isNaN(when.getTime())) continue;
    const id = text(block, "guid") || start;
    const title = decode(text(block, "title")) || "The SpaceBat Show";
    shows.push({ id, title, start: when.toISOString() });
  }
  return shows;
}

export function parsePostedShows(xml: string): PostedShow[] {
  const shows: PostedShow[] = [];
  const seen = new Set<string>();
  for (const block of collect(xml, "item")) {
    const audio = enclosureUrl(block);
    if (!audio || audio.includes(STREAM_HOST)) continue;
    const guid = text(block, "guid");
    const link = text(block, "link");
    const title = decode(text(block, "title")) || "The SpaceBat Show";
    const slug = slugFrom(link, title, guid);
    const id = guid || slug;
    if (seen.has(id)) continue;
    seen.add(id);
    const pub = text(block, "pubDate");
    const when = pub ? new Date(pub) : null;
    shows.push({
      id,
      title,
      slug,
      publishedAt: when && !Number.isNaN(when.getTime()) ? when.toISOString() : "",
    });
  }
  return shows;
}

/** Morning in New York, and the Podhome live item starts that same calendar day. */
export function showsDueThisMorning(now: Date, shows: ScheduledShow[]): ScheduledShow[] {
  const hour = nyHour(now);
  if (hour < 7 || hour > 10) return [];
  const today = nyDateKey(now);
  return shows.filter((show) => nyDateKey(new Date(show.start)) === today);
}

export function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatShowWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function nyHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

function collect(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(re) ?? [];
}

function text(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"),
  );
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return plain ? plain[1].trim() : "";
}

function enclosureUrl(block: string): string {
  const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0] ?? "";
  return attr(enclosure, "url");
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ? decode(match[1]) : "";
}

function slugFrom(link: string, title: string, guid: string): string {
  const fromLink = link.match(/episodepage\/[^/]+\/([^/?#]+)/i)?.[1];
  if (fromLink) return decodeURIComponent(fromLink);
  const fromTitle = title
    .toLowerCase()
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return fromTitle || guid.slice(0, 12) || "episode";
}

function decode(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'");
}

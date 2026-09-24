import type { Episode } from "@/data/show";

const STREAM_HOST = "stream.podhome.fm";

export function parsePublishedEpisodes(xml: string): Episode[] {
  const blocks = [
    ...collect(xml, "item"),
    ...collect(xml, "podcast:liveItem").filter((block) => /status="ended"/i.test(block)),
  ];
  const episodes: Episode[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const audio = enclosureUrl(block);
    if (!audio || audio.includes(STREAM_HOST)) continue;
    const guid = text(block, "guid");
    const link = text(block, "link");
    const title = decode(text(block, "title")) || "SpaceBat";
    const slug = slugFrom(link, title, guid);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const description = clean(
      text(block, "itunes:summary") || text(block, "description") || text(block, "content:encoded"),
    );
    const pub = text(block, "pubDate");
    const when = pub ? new Date(pub) : null;
    const number = text(block, "itunes:episode") || String(episodes.length + 1);
    episodes.push({
      slug,
      code: number.padStart(2, "0"),
      title,
      teaser: description.slice(0, 180),
      description: description || "A SpaceBat episode.",
      date: when && !Number.isNaN(when.getTime()) ? when.toISOString() : "",
      dateLabel:
        when && !Number.isNaN(when.getTime())
          ? when.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "America/New_York",
            })
          : "Posted",
      cover: imageUrl(block) || "/cover/SpaceBat-cover-3000.jpg",
      listenUrl: audio,
      pageUrl: link && !link.includes(STREAM_HOST) ? link : undefined,
      status: "published",
      topics: [],
    });
  }

  episodes.sort((a, b) => (a.date < b.date ? 1 : -1));
  episodes.forEach((episode, index) => {
    if (!textHasNumber(episode.code)) episode.code = String(episodes.length - index).padStart(2, "0");
  });
  return episodes;
}

function textHasNumber(code: string) {
  return /^\d+$/.test(code);
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

function imageUrl(block: string): string {
  const tag =
    block.match(/<itunes:image\b[^>]*>/i)?.[0] ??
    block.match(/<podcast:image\b[^>]*>/i)?.[0] ??
    "";
  return attr(tag, "href");
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

function clean(value: string): string {
  return decode(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decode(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

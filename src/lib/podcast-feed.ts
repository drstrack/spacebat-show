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
    const rawNotes =
      text(block, "content:encoded") || text(block, "description") || text(block, "itunes:summary");
    const notes = parseShowNotes(rawNotes);
    const description = notes.paragraphs.join("\n\n") || "A SpaceBat episode.";
    const pub = text(block, "pubDate");
    const when = pub ? new Date(pub) : null;
    const number = text(block, "itunes:episode") || String(episodes.length + 1);
    episodes.push({
      slug,
      code: number.padStart(2, "0"),
      title,
      teaser: (notes.paragraphs[0] ?? description).slice(0, 180),
      description,
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
      notes,
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

function parseShowNotes(html: string): Episode["notes"] {
  const list = html.match(/<ul\b[\s\S]*?<\/ul>/i)?.[0] ?? "";
  const prose = html.replace(/<ul\b[\s\S]*?<\/ul>/i, " ");
  const paragraphs = decode(prose.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const links: Episode["notes"]["links"] = [];
  for (const item of list.match(/<li\b[\s\S]*?<\/li>/gi) ?? []) {
    const href = decode(item.match(/href="([^"]+)"/i)?.[1] ?? "").replace(/\s+/g, "");
    if (!/^https?:\/\//i.test(href)) continue;
    const label = decode(item.replace(/<a\b[\s\S]*?<\/a>/gi, " ").replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .replace(/:\s*$/, "")
      .trim();
    links.push({ label: label || href, href });
  }

  return { paragraphs, links };
}

function decode(value: string): string {
  return value
    .replace(/\u0026amp;/g, "&")
    .replace(/\u0026lt;/g, "<")
    .replace(/\u0026gt;/g, ">")
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;|\u0026apos;/g, "'")
    .replace(/\u0026nbsp;/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "");
}

import type { Episode, EpisodeChapter, EpisodeClip } from "@/data/show";

const STREAM_HOST = "stream.podhome.fm";

export function feedIsLive(xml: string) {
  return /<podcast:liveItem\b[^>]*\bstatus="live"/i.test(xml);
}

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
    const rawNumber = text(block, "itunes:episode");
    const code = episodeCode(title, rawNumber, when, imageUrl(block));
    episodes.push({
      slug,
      code,
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
      chaptersUrl: chaptersUrl(block),
      clips: parseClips(block),
      status: "published",
      topics: [],
      notes,
    });
  }

  episodes.sort((a, b) => (a.date < b.date ? 1 : -1));
  const nonZero = episodes.filter((episode) => episode.code !== "0");
  nonZero.forEach((episode, index) => {
    if (!textHasNumber(episode.code)) {
      episode.code = String(nonZero.length - index).padStart(2, "0");
    }
  });
  return episodes;
}

function episodeCode(title: string, rawNumber: string, when: Date | null, artwork: string) {
  if (isEpisodeZero(title, when, artwork)) return "0";
  const fromFeed = parseEpisodeNumber(rawNumber);
  if (fromFeed) return fromFeed;
  const fromTitle = numberFromText(title);
  if (fromTitle) return fromTitle;
  const fromArt = numberFromText(decodeUri(artwork));
  if (fromArt) return fromArt;
  return "";
}

function isEpisodeZero(title: string, when: Date | null, artwork: string) {
  if (/\bepisode\s*(zero|0)\b/i.test(title)) return true;
  if (artwork && /\bepisode[\s_-]*(zero|0)\b/i.test(decodeUri(artwork))) return true;
  if (when && !Number.isNaN(when.getTime())) {
    const label = when.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
    if (label === "9/23/2026" || label === "6/23/2026") return true;
  }
  return false;
}

function parseEpisodeNumber(raw: string) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return "";
  return trimmed === "0" ? "0" : trimmed.padStart(2, "0");
}

function numberFromText(value: string) {
  if (/\bepisode\s*(zero|0)\b/i.test(value)) return "0";
  const words: Record<string, string> = {
    one: "01",
    two: "02",
    three: "03",
    four: "04",
    five: "05",
    six: "06",
    seven: "07",
    eight: "08",
    nine: "09",
    ten: "10",
    eleven: "11",
    twelve: "12",
  };
  const word = value.match(
    /\bepisode\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
  );
  if (word?.[1]) return words[word[1].toLowerCase()] ?? "";
  const numeric = value.match(/\bepisode[\s_-]*(\d+)\b/i);
  if (!numeric?.[1]) return "";
  const number = numeric[1].replace(/^0+(?=\d)/, "");
  return number === "0" ? "0" : number.padStart(2, "0");
}

function decodeUri(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function chaptersUrl(block: string): string | undefined {
  const tag = block.match(/<podcast:chapters\b[^>]*>/i)?.[0] ?? "";
  const url = attr(tag, "url");
  return url.startsWith("https://") ? url : undefined;
}

function parseClips(block: string): EpisodeClip[] {
  const tags = block.match(/<podcast:soundbite\b[\s\S]*?<\/podcast:soundbite>/gi) ?? [];
  return tags
    .map((tag) => {
      const start = Number(attr(tag, "startTime"));
      const duration = Number(attr(tag, "duration"));
      const title = attr(tag, "title");
      const quote = decode(text(tag, "podcast:soundbite")).replace(/\s+/g, " ").trim();
      return {
        start,
        duration: Number.isFinite(duration) ? duration : 0,
        title: title || undefined,
        text: quote,
      };
    })
    .filter((clip) => Number.isFinite(clip.start))
    .sort((a, b) => a.start - b.start);
}

export function parseChapters(json: unknown): EpisodeChapter[] {
  const list = (json as { chapters?: unknown })?.chapters;
  if (!Array.isArray(list)) return [];
  return list
    .map((chapter) => {
      const row = chapter as { startTime?: unknown; title?: unknown; url?: unknown; img?: unknown };
      const start = Number(row.startTime);
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const url = typeof row.url === "string" && row.url.startsWith("http") ? row.url : undefined;
      const image = typeof row.img === "string" && row.img.startsWith("http") ? row.img : undefined;
      return { start, title, url, image };
    })
    .filter((chapter) => chapter.title && Number.isFinite(chapter.start))
    .sort((a, b) => a.start - b.start);
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
    block.match(/<itunes:image\b[^>]*>/i)?.[0] ?? block.match(/<podcast:image\b[^>]*>/i)?.[0] ?? "";
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
  const paragraphs = decode(
    prose
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
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

import type { Episode, EpisodeChapter, EpisodeClip, ShowNoteLink } from "@/data/show";

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
    const code = episodeCode(title, rawNumber, when, String(episodes.length + 1));
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
  episodes.forEach((episode, index) => {
    if (!textHasNumber(episode.code))
      episode.code = String(episodes.length - index).padStart(2, "0");
  });
  return episodes;
}

function episodeCode(title: string, rawNumber: string, when: Date | null, fallback: string) {
  if (/\bepisode\s*(zero|0)\b/i.test(title)) return "0";
  if (when && !Number.isNaN(when.getTime())) {
    const label = when.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
    if (label === "9/23/2026" || label === "6/23/2026") return "0";
  }
  const number = rawNumber || fallback;
  return number === "0" ? "0" : number.padStart(2, "0");
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
  // A non-greedy </ul> stops at the first nested list and leaves the rest of
  // the notes in the description. Take the balanced outer list instead.
  const list = findBalanced(html, "ul", 0);
  const prose = list ? `${html.slice(0, list.start)} ${html.slice(list.end)}` : html;
  const paragraphs = decode(
    prose
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const links = list ? readList(html.slice(list.start, list.end), false) : [];
  return { paragraphs, links };
}

type Span = { start: number; end: number };

function findBalanced(html: string, tag: string, from: number): Span | null {
  const start = nextTag(html, tag, from, false);
  if (start < 0) return null;
  let depth = 1;
  let i = start + tag.length + 1;
  while (depth > 0) {
    const nextOpen = nextTag(html, tag, i, false);
    const nextClose = nextTag(html, tag, i, true);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + tag.length + 1;
      continue;
    }
    depth -= 1;
    const closeEnd = html.indexOf(">", nextClose);
    if (closeEnd < 0) return null;
    i = closeEnd + 1;
  }
  return { start, end: i };
}

function nextTag(html: string, tag: string, from: number, closing: boolean): number {
  const needle = `${closing ? "</" : "<"}${tag}`.toLowerCase();
  const lower = html.toLowerCase();
  let i = from;
  while (i < html.length) {
    const at = lower.indexOf(needle, i);
    if (at < 0) return -1;
    const next = html[at + needle.length] ?? "";
    const boundary = closing
      ? /^\s*>/.test(html.slice(at + needle.length))
      : next === ">" || next === "/" || /\s/.test(next);
    if (boundary) return at;
    i = at + 1;
  }
  return -1;
}

function readList(listHtml: string, nested: boolean, parentHref = ""): ShowNoteLink[] {
  const inner = stripWrapper(listHtml, "ul");
  const links: ShowNoteLink[] = [];
  let cursor = 0;
  while (cursor < inner.length) {
    const li = findBalanced(inner, "li", cursor);
    const ul = findBalanced(inner, "ul", cursor);
    const next = earliest(li, ul);
    if (!next || next.end <= cursor) break;
    if (next.kind === "ul") {
      const children = readList(
        inner.slice(next.start, next.end),
        true,
        links.at(-1)?.href || parentHref,
      );
      const prev = links.at(-1);
      if (prev) {
        for (const child of children) attach(prev, child);
      } else if (nested) {
        links.push(...children);
      } else {
        for (const child of children) {
          if (child.href) links.push(child);
        }
      }
      cursor = next.end;
      continue;
    }

    const liInner = stripWrapper(inner.slice(next.start, next.end), "li");
    const { own, lists } = splitNestedUls(liInner);
    const rawHref = firstRawHref(own);
    const href = usableHref(rawHref);
    const children = lists.flatMap((list) => readList(list, true, href || parentHref));
    cursor = next.end;

    const prev = links.at(-1);
    if (!nested && prev && brokenSubBullet(rawHref, prev.href, own)) {
      for (const note of textNotes(own, children, rawHref, prev.href)) attach(prev, note);
      continue;
    }
    if (!href) {
      if (nested) links.push(...textNotes(own, children, rawHref, parentHref));
      continue;
    }
    const link: ShowNoteLink = { label: labelFrom(own) || href, href };
    if (children.length) link.children = children;
    links.push(link);
  }
  return links;
}

function earliest(li: Span | null, ul: Span | null): (Span & { kind: "li" | "ul" }) | null {
  if (li && (!ul || li.start <= ul.start)) return { ...li, kind: "li" };
  if (ul) return { ...ul, kind: "ul" };
  return null;
}

function splitNestedUls(html: string): { own: string; lists: string[] } {
  const lists: string[] = [];
  let own = "";
  let cursor = 0;
  while (cursor < html.length) {
    const found = findBalanced(html, "ul", cursor);
    if (!found || found.end <= cursor) {
      own += html.slice(cursor);
      break;
    }
    own += html.slice(cursor, found.start);
    lists.push(html.slice(found.start, found.end));
    cursor = found.end;
  }
  return { own, lists };
}

function stripWrapper(html: string, tag: string): string {
  return html
    .replace(new RegExp(`^\\s*<${tag}\\b[^>]*>`, "i"), "")
    .replace(new RegExp(`</${tag}\\s*>\\s*$`, "i"), "");
}

function firstRawHref(html: string): string {
  return html.match(/href="([^"]*)"/i)?.[1] ?? "";
}

function usableHref(raw: string): string {
  const href = decode(raw).replace(/\s+/g, "");
  if (!/^https?:\/\//i.test(href)) return "";
  // An apostrophe or quote is sub-bullet text glued onto a URL, not a link.
  if (/['"<>]/.test(href)) return "";
  return href;
}

function suffixOf(href: string, parentHref: string): string {
  if (!href || !parentHref || href === parentHref) return "";
  if (href.startsWith(parentHref)) return href.slice(parentHref.length);
  const base = parentHref.replace(/\/+$/, "");
  if (base && href.startsWith(`${base}/`)) return href.slice(base.length + 1);
  return "";
}

function brokenSubBullet(rawHref: string, parentHref: string, itemHtml: string): boolean {
  const href = decode(rawHref).replace(/\s+/g, "");
  if (!href || usableHref(rawHref)) return false;
  const suffix = suffixOf(href, parentHref);
  if (!suffix) return false;
  const visible = decode(itemHtml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, "");
  return visible.includes(suffix.replace(/\s+/g, ""));
}

function textNotes(
  html: string,
  children: ShowNoteLink[],
  rawHref = "",
  parentHref = "",
): ShowNoteLink[] {
  const href = decode(rawHref).replace(/\s+/g, "");
  let label = decode(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  const suffix = suffixOf(href, parentHref);
  if (href && label.includes(href)) label = label.replace(href, suffix);
  label = label.replace(/\s+/g, " ").replace(/:\s*$/, "").trim();
  if (!label) return children;
  const note: ShowNoteLink = { label, href: "" };
  if (children.length) note.children = children;
  return [note];
}

function labelFrom(html: string): string {
  return decode(html.replace(/<a\b[\s\S]*?<\/a>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/:\s*$/, "")
    .trim();
}

function attach(parent: ShowNoteLink, child: ShowNoteLink) {
  parent.children = parent.children ? [...parent.children, child] : [child];
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

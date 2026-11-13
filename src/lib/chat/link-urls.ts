import { tokenize } from "./render.ts";

/** Plain text shown on a preview card. Image is an absolute http(s) URL or null. */
export type LinkPreview = {
  siteName: string;
  title: string;
  description: string;
  image: string | null;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** First http(s) URL in a chat message, or null when there isn't one. */
export function firstPreviewUrl(body: string): string | null {
  for (const token of tokenize(body)) {
    if (token.type === "link" || token.type === "image") return token.href;
  }
  return null;
}

/** YouTube video id for watch, short, embed, live, and youtu.be links. */
export function youtubeVideoId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (
    host !== "youtube.com" &&
    host !== "m.youtube.com" &&
    host !== "music.youtube.com" &&
    host !== "youtube-nocookie.com"
  ) {
    return null;
  }
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
    const id = parts[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  return null;
}

import { getSql, type Sql } from "@/lib/db";
import { CHAT_RULES_VERSION } from "@/lib/chat/rules";

const SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const CACHE_MS = 10 * 60_000;
const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 10;

export type GifHit = {
  id: string;
  title: string;
  preview: string;
};

const cache = new Map<string, { at: number; hits: GifHit[] }>();
const searches = new Map<string, number[]>();

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireMember(sql: Sql, userId: string): Promise<void> {
  const rows = await sql<{
    rules_version: number | string | bigint;
    rules_accepted_ms: number | string | bigint | null;
    banned_ms: number | string | bigint | null;
  }>`
    select rules_version, rules_accepted_ms, banned_ms
    from chat_member
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || num(row.rules_version) < CHAT_RULES_VERSION || row.rules_accepted_ms == null) {
    throw new Error("Accept the room rules first.");
  }
  if (row.banned_ms != null) throw new Error("You can't post in the room.");
}

function rememberSearch(userId: string, now: number): void {
  const recent = (searches.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_MINUTE) {
    throw new Error("Too many GIF searches. Try again in a minute.");
  }
  recent.push(now);
  searches.set(userId, recent);
}

function gifKey(): string {
  return process.env.GIPHY_API_KEY?.trim() ?? "";
}

export function gifSearchEnabled(): boolean {
  return gifKey().length > 0;
}

type GiphyPayload = {
  data?: Array<{
    id?: string;
    title?: string;
    images?: {
      fixed_width_small?: { url?: string };
      fixed_width?: { url?: string };
      downsized?: { url?: string };
    };
  }>;
};

function pickPreview(gif: NonNullable<GiphyPayload["data"]>[number]): string | null {
  const candidate =
    gif.images?.fixed_width_small?.url ||
    gif.images?.fixed_width?.url ||
    gif.images?.downsized?.url ||
    "";
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseHits(payload: GiphyPayload): GifHit[] {
  const hits: GifHit[] = [];
  for (const gif of payload.data ?? []) {
    const id = gif.id ?? "";
    if (!/^[A-Za-z0-9]+$/.test(id)) continue;
    const preview = pickPreview(gif);
    if (!preview) continue;
    hits.push({ id, title: gif.title?.trim() || "GIF", preview });
  }
  return hits;
}

export async function searchGifs(userId: string, q: string): Promise<GifHit[]> {
  const key = gifKey();
  if (!key) return [];
  const query = q.trim().slice(0, 50);
  if (!query) return [];
  const sql = await getSql();
  await requireMember(sql, userId);
  const now = Date.now();
  rememberSearch(userId, now);
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < CACHE_MS) return cached.hits;

  const url = new URL(SEARCH_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("limit", "24");
  url.searchParams.set("bundle", "messaging_non_clips");
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("GIF search is unavailable.");
  }
  if (!response.ok) throw new Error("GIF search is unavailable.");
  const payload = (await response.json()) as GiphyPayload;
  const hits = parseHits(payload);
  cache.set(cacheKey, { at: now, hits });
  return hits;
}

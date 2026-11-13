import { lookup } from "node:dns/promises";
import { getSql, type Sql } from "@/lib/db";
import { CHAT_RULES_VERSION } from "@/lib/chat/rules";
import { requestPublic } from "@/lib/chat/link-preview-http";
import {
  bareHostname,
  consumePreviewBudget,
  PREVIEW_FETCH_LIMIT,
  PREVIEW_TIMEOUT_MS,
  PREVIEW_WINDOW_MS,
  previewKey,
  resolveLinkPreview,
  type PreviewAddress,
} from "@/lib/chat/link-preview";
import type { LinkPreview } from "@/lib/chat/link-urls";

export type LinkPreviewStatus = "ready" | "empty" | "limited";

export type LinkPreviewResult = {
  url: string;
  status: LinkPreviewStatus;
  preview: LinkPreview | null;
};

/**
 * Metadata is fetched here, never from the browser. Hits and misses stay in
 * memory (the same approach as GIF search) so repeat views don't refetch.
 * A table was skipped: main is already on migration 0016, and 0017 is the
 * number the in-flight media ratings work is expected to take.
 */
const OK_TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 400;

type CacheEntry = { at: number; preview: LinkPreview | null };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<LinkPreview | null>>();
const budgets = new Map<string, number[]>();

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

function allowFetch(userId: string, now = Date.now()): boolean {
  const decision = consumePreviewBudget(
    budgets.get(userId) ?? [],
    now,
    PREVIEW_FETCH_LIMIT,
    PREVIEW_WINDOW_MS,
  );
  budgets.set(userId, decision.stamps);
  if (budgets.size > 2000) {
    const oldest = budgets.keys().next().value;
    if (oldest && oldest !== userId) budgets.delete(oldest);
  }
  return decision.allowed;
}

function readCache(key: string, now = Date.now()): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  const ttl = entry.preview ? OK_TTL_MS : MISS_TTL_MS;
  if (now - entry.at > ttl) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function writeCache(key: string, preview: LinkPreview | null, now = Date.now()): void {
  cache.delete(key);
  cache.set(key, { at: now, preview });
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function withTimeout<T>(work: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    const onAbort = () => reject(new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    });
  });
}

export async function lookupPublic(
  hostname: string,
  signal: AbortSignal,
): Promise<PreviewAddress[]> {
  if (signal.aborted) throw new Error("aborted");
  const records = await withTimeout(
    lookup(bareHostname(hostname), { all: true, verbatim: true }),
    PREVIEW_TIMEOUT_MS,
    signal,
  );
  return records.map((record) => ({
    address: record.address,
    family: record.family === 6 ? 6 : 4,
  }));
}

async function fetchPreview(key: string): Promise<LinkPreview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  timer.unref?.();
  try {
    return await resolveLinkPreview(
      key,
      { lookup: lookupPublic, request: requestPublic },
      controller.signal,
    );
  } finally {
    clearTimeout(timer);
  }
}

function startFetch(key: string): Promise<LinkPreview | null> {
  const promise = fetchPreview(key)
    .then((preview) => {
      writeCache(key, preview);
      return preview;
    })
    .catch(() => {
      writeCache(key, null);
      return null;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

async function previewOne(userId: string, raw: string): Promise<LinkPreviewResult> {
  const key = previewKey(raw);
  if (!key) return { url: raw, status: "empty", preview: null };
  const cached = readCache(key);
  if (cached)
    return { url: raw, status: cached.preview ? "ready" : "empty", preview: cached.preview };
  const existing = inflight.get(key);
  if (!existing && !allowFetch(userId)) return { url: raw, status: "limited", preview: null };
  const preview = await (existing ?? startFetch(key));
  return { url: raw, status: preview ? "ready" : "empty", preview };
}

export async function getLinkPreviews(
  userId: string,
  urls: readonly string[],
): Promise<LinkPreviewResult[]> {
  const sql = await getSql();
  await requireMember(sql, userId);
  const pending = new Map<string, Promise<LinkPreviewResult>>();
  const results: Promise<LinkPreviewResult>[] = [];
  for (const url of urls) {
    let job = pending.get(url);
    if (!job) {
      job = previewOne(userId, url);
      pending.set(url, job);
    }
    results.push(job);
  }
  return Promise.all(results);
}

import { requestPublic } from "../chat/link-preview-http.ts";
import {
  bareHostname,
  fetchPublicDocument,
  isBlockedIp,
  PREVIEW_MAX_BYTES,
  PREVIEW_TIMEOUT_MS,
  publicHttpUrl,
  type PreviewLookup,
  type PreviewRequest,
} from "../chat/link-preview.ts";

export class PublicFetchError extends Error {
  readonly code: "blocked" | "failed";
  constructor(code: "blocked" | "failed", message: string) {
    super(message);
    this.name = "PublicFetchError";
    this.code = code;
  }
}

export const FETCH_BLOCKED = "That link isn't allowed.";
export const FETCH_FAILED = "Couldn't read that page.";

export type TechFetch = {
  finalUrl: string;
  contentType: string;
  body: Uint8Array;
  truncated: boolean;
};

/**
 * Read a public product page or picture. Address checks, DNS pinning, redirect
 * limits, and the default byte cap come from the chat link preview. A blocked
 * target throws. A failed read throws {@link FETCH_FAILED}.
 */
export async function fetchTechResource(
  rawUrl: string,
  options: {
    maxBytes: number;
    accept?: string;
    lookup?: PreviewLookup;
    request?: PreviewRequest;
  },
): Promise<TechFetch> {
  const safe = publicHttpUrl(rawUrl);
  if (!safe) throw new PublicFetchError("blocked", FETCH_BLOCKED);
  const lookup =
    options.lookup ??
    (await import("../chat/link-preview.server.ts")).lookupPublic;
  const host = bareHostname(safe.hostname);
  const literal = host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  if (!literal) {
    let records;
    try {
      records = await lookup(host, AbortSignal.timeout(PREVIEW_TIMEOUT_MS));
    } catch {
      throw new PublicFetchError("failed", FETCH_FAILED);
    }
    if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
      throw new PublicFetchError("blocked", FETCH_BLOCKED);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    const doc = await fetchPublicDocument(
      safe.href,
      { lookup, request: options.request ?? requestPublic },
      controller.signal,
      { accept: options.accept, maxBytes: options.maxBytes },
    );
    if (!doc) throw new PublicFetchError("failed", FETCH_FAILED);
    return {
      finalUrl: doc.url,
      contentType: doc.contentType,
      body: doc.body,
      truncated: doc.body.byteLength >= options.maxBytes,
    };
  } finally {
    clearTimeout(timer);
  }
}

export { PREVIEW_MAX_BYTES };

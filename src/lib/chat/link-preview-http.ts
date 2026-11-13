import http from "node:http";
import https from "node:https";
import {
  bareHostname,
  isAllowedPreviewPort,
  isBlockedIp,
  PREVIEW_MAX_BYTES,
  type PreviewRequest,
} from "./link-preview.ts";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SpaceBatShowLinkPreview/1.0; +https://www.spacebatshow.net)";

/** Thrown before a socket opens when the address or port is not allowed. */
export class BlockedAddressError extends Error {
  constructor() {
    super("blocked address");
    this.name = "BlockedAddressError";
  }
}

function headerString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function hostHeader(url: URL): string {
  const bare = bareHostname(url.hostname);
  const name = bare.includes(":") ? `[${bare}]` : bare;
  return url.port ? `${name}:${url.port}` : name;
}

/**
 * GET `url` with the TCP connection pinned to `address`. Redirects are not
 * followed. The body is capped at {@link PREVIEW_MAX_BYTES}. Callers must
 * already have decided the target is public; this still refuses a blocked
 * address or a non-80/443 port so a private IP cannot be dialed by mistake.
 */
export const requestPublic: PreviewRequest = (input) => {
  if (!isAllowedPreviewPort(input.url)) throw new BlockedAddressError();
  if (input.url.protocol !== "http:" && input.url.protocol !== "https:") {
    throw new BlockedAddressError();
  }
  if (isBlockedIp(input.address)) throw new BlockedAddressError();

  const isHttps = input.url.protocol === "https:";
  const lib = isHttps ? https : http;
  const bare = bareHostname(input.url.hostname);
  const path = `${input.url.pathname}${input.url.search}` || "/";
  const options: https.RequestOptions = {
    host: input.address,
    family: input.family,
    port: input.url.port ? Number(input.url.port) : isHttps ? 443 : 80,
    method: "GET",
    path,
    headers: {
      host: hostHeader(input.url),
      accept: input.accept,
      "accept-language": "en",
      "accept-encoding": "identity",
      "user-agent": USER_AGENT,
      connection: "close",
    },
    rejectUnauthorized: true,
    servername:
      isHttps && !bare.includes(":") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(bare) ? bare : undefined,
    signal: input.signal,
  };

  return new Promise((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      let received = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve({
          status: res.statusCode ?? 0,
          location: headerString(res.headers.location),
          contentType: headerString(res.headers["content-type"]) ?? "",
          body: Buffer.concat(chunks),
        });
      };
      res.on("error", (err) => {
        if (settled || received >= PREVIEW_MAX_BYTES) finish();
        else reject(err);
      });
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        finish();
        res.destroy();
        return;
      }
      res.on("data", (chunk: Buffer) => {
        if (received >= PREVIEW_MAX_BYTES) return;
        const room = PREVIEW_MAX_BYTES - received;
        const slice = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
        chunks.push(slice);
        received += slice.byteLength;
        if (received >= PREVIEW_MAX_BYTES) {
          finish();
          res.destroy();
        }
      });
      res.on("end", finish);
    });
    req.setTimeout(5_000, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.end();
  });
};

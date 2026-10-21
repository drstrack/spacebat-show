/**
 * Chat blob credentials. Server only.
 *
 * Production uses a separate store, so its variables are `BLOB_PROD_*`.
 * Preview keeps the plain `BLOB_*` names. Each value prefers the prod name
 * and falls back with `??`. Callers pass `token` into `@vercel/blob` so the
 * SDK does not read `BLOB_READ_WRITE_TOKEN` itself.
 */
export type BlobCredentials = {
  token: string;
  storeId: string;
  webhookPublicKey: string;
};

type Env = Record<string, string | undefined>;

function pick(env: Env, prodName: string, previewName: string): string {
  return (env[prodName] ?? env[previewName] ?? "").trim();
}

export function readBlobCredentials(env: Env): BlobCredentials {
  return {
    token: pick(env, "BLOB_PROD_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN"),
    storeId: pick(env, "BLOB_PROD_STORE_ID", "BLOB_STORE_ID"),
    webhookPublicKey: pick(env, "BLOB_PROD_WEBHOOK_PUBLIC_KEY", "BLOB_WEBHOOK_PUBLIC_KEY"),
  };
}

export function blobCredentials(): BlobCredentials {
  return readBlobCredentials(process.env);
}

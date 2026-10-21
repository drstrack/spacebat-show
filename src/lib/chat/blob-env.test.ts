import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readBlobCredentials } from "./blob-env.server.ts";
import { blobPublicHost } from "./uploads.ts";

describe("blob env fallback", () => {
  it("prefers BLOB_PROD_* and falls back to plain BLOB_*", () => {
    const prod = readBlobCredentials({
      BLOB_PROD_READ_WRITE_TOKEN: "vercel_blob_rw_prodstore_secret",
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_previewstore_secret",
      BLOB_PROD_STORE_ID: "store_prodstore",
      BLOB_STORE_ID: "store_previewstore",
      BLOB_PROD_WEBHOOK_PUBLIC_KEY: "prod-key",
      BLOB_WEBHOOK_PUBLIC_KEY: "preview-key",
    });
    assert.equal(prod.token, "vercel_blob_rw_prodstore_secret");
    assert.equal(prod.storeId, "store_prodstore");
    assert.equal(prod.webhookPublicKey, "prod-key");
    assert.equal(Boolean(prod.token), true);
    assert.equal(
      blobPublicHost({ storeId: prod.storeId, token: prod.token }),
      "prodstore.public.blob.vercel-storage.com",
    );

    const preview = readBlobCredentials({
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_previewstore_secret",
      BLOB_STORE_ID: "store_previewstore",
      BLOB_WEBHOOK_PUBLIC_KEY: "preview-key",
    });
    assert.equal(preview.token, "vercel_blob_rw_previewstore_secret");
    assert.equal(preview.storeId, "store_previewstore");
    assert.equal(preview.webhookPublicKey, "preview-key");
    assert.equal(Boolean(preview.token), true);
    assert.equal(
      blobPublicHost({ storeId: preview.storeId, token: preview.token }),
      "previewstore.public.blob.vercel-storage.com",
    );

    const fromToken = readBlobCredentials({
      BLOB_PROD_READ_WRITE_TOKEN: "vercel_blob_rw_fromtoken_secret",
    });
    assert.equal(fromToken.storeId, "");
    assert.equal(
      blobPublicHost({ storeId: fromToken.storeId, token: fromToken.token }),
      "fromtoken.public.blob.vercel-storage.com",
    );

    const off = readBlobCredentials({});
    assert.equal(off.token, "");
    assert.equal(off.storeId, "");
    assert.equal(off.webhookPublicKey, "");
    assert.equal(Boolean(off.token), false);
    assert.equal(blobPublicHost({ storeId: off.storeId, token: off.token }), null);
  });
});

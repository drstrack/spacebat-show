import assert from "node:assert/strict";
import test from "node:test";
import { MEDIA_HOST_EMAILS } from "./media.ts";
import { previewHostShouldBeAdmin } from "./preview-host-admin.ts";

test("preview and the in-memory database make John and Dan admins", () => {
  for (const email of [MEDIA_HOST_EMAILS.dan, MEDIA_HOST_EMAILS.john, "Jack2Ryan@aim.com"]) {
    assert.equal(
      previewHostShouldBeAdmin({ vercelEnv: "preview", dbSource: "pglite", email }),
      true,
      email,
    );
  }
  assert.equal(
    previewHostShouldBeAdmin({ vercelEnv: undefined, dbSource: "pglite", email: MEDIA_HOST_EMAILS.dan }),
    true,
  );
  assert.equal(
    previewHostShouldBeAdmin({
      vercelEnv: "preview",
      dbSource: "pglite",
      email: "spacebatshow@gmail.com",
    }),
    false,
  );
});

test("production and Turso never grant the preview host admin", () => {
  for (const email of [MEDIA_HOST_EMAILS.dan, MEDIA_HOST_EMAILS.john]) {
    assert.equal(
      previewHostShouldBeAdmin({ vercelEnv: "production", dbSource: "pglite", email }),
      false,
    );
    assert.equal(
      previewHostShouldBeAdmin({ vercelEnv: "production", dbSource: "turso", email }),
      false,
    );
    assert.equal(
      previewHostShouldBeAdmin({ vercelEnv: "preview", dbSource: "turso", email }),
      false,
    );
    assert.equal(
      previewHostShouldBeAdmin({ vercelEnv: undefined, dbSource: "turso", email }),
      false,
    );
    assert.equal(
      previewHostShouldBeAdmin({ vercelEnv: undefined, dbSource: "neon", email }),
      false,
    );
  }
});

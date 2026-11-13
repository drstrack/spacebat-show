import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { mediaAdminDecision } from "../media.ts";
import { applySqliteMigration, bootstrapSqliteSchema } from "../sqlite-migrate.ts";
import { isBlockedIp, publicHttpUrl, type PreviewLookup, type PreviewRequest } from "../chat/link-preview.ts";
import { classifyImageBytes, TECH_IMAGE_MAX_BYTES } from "./image-file.ts";
import { readPageMeta } from "./page-meta.ts";
import {
  applyTechImagePlan,
  deleteTechProduct,
  mergeEmptyCopy,
  parseTechInput,
  planTechImage,
  saveTechProduct,
  techAdminDecision,
  techBlobPathname,
  TECH_BLOB_PATH,
  type TechIo,
  type TechSql,
} from "./products.ts";
import { fetchTechResource } from "./fetch-public.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT = "11111111-1111-4111-8111-111111111111";

const PAGE = `<!doctype html><html><head>
<meta property="og:title" content="Desk Mic">
<meta property="og:description" content="The one on the desk.">
<meta property="og:image" content="https://cdn.example/og.jpg">
<meta name="twitter:image" content="https://cdn.example/tw.jpg">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Desk Mic","image":["https://cdn.example/product.jpg"]}
</script>
<link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
<link rel="icon" type="image/png" sizes="512x512" href="/icon.png">
</head></html>`;

type Stored = {
  id: string;
  name: string;
  description: string;
  product_url: string;
  image_url: string | null;
  image_source: string;
  auto_image_url: string | null;
  recommended_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function memoryDb(role: string | null) {
  const rows: Stored[] = [];
  const calls: string[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    calls.push(text);
    if (text.includes("member_profile")) return role ? [{ role }] : [];
    if (text.includes("next_sort")) {
      const max = rows.reduce((best, row) => Math.max(best, row.sort_order), -1);
      return [{ next_sort: max + 1 }];
    }
    if (text.startsWith("insert into tech_product")) {
      rows.push({
        id: String(values[0]),
        name: String(values[1]),
        description: String(values[2]),
        product_url: String(values[3]),
        image_url: values[4] == null ? null : String(values[4]),
        image_source: String(values[5]),
        auto_image_url: values[6] == null ? null : String(values[6]),
        recommended_by: values[7] == null ? null : String(values[7]),
        sort_order: Number(values[8]),
        created_at: String(values[9]),
        updated_at: String(values[10]),
      });
      return [];
    }
    if (text.startsWith("update tech_product")) {
      const row = rows.find((item) => item.id === String(values[9]));
      if (!row) return [];
      row.name = String(values[0]);
      row.description = String(values[1]);
      row.product_url = String(values[2]);
      row.image_url = values[3] == null ? null : String(values[3]);
      row.image_source = String(values[4]);
      row.auto_image_url = values[5] == null ? null : String(values[5]);
      row.recommended_by = values[6] == null ? null : String(values[6]);
      row.sort_order = Number(values[7]);
      row.updated_at = String(values[8]);
      return [];
    }
    if (text.startsWith("delete from tech_product")) {
      const index = rows.findIndex((item) => item.id === String(values[0]));
      if (index >= 0) rows.splice(index, 1);
      return [];
    }
    if (text.includes("where id")) return rows.filter((item) => item.id === String(values[0]));
    if (text.includes("order by")) return [...rows];
    throw new Error(`unexpected sql: ${text}`);
  }) as TechSql;
  return { sql, rows, calls };
}

function io(fetchProduct?: TechIo["fetchProduct"]): TechIo & { fetches: string[]; copies: string[] } {
  const fetches: string[] = [];
  const copies: string[] = [];
  return {
    fetches,
    copies,
    now: () => new Date("2026-11-13T12:00:00.000Z"),
    newId: () => PRODUCT,
    fetchProduct:
      fetchProduct ??
      (async (url) => {
        fetches.push(url);
        return {
          title: "Fetched Mic",
          description: "A microphone.",
          imageUrl: "https://cdn.example/auto.jpg",
        };
      }),
    copyImage: async (url) => {
      copies.push(url);
      return { url: `https://blob.example/${copies.length}.jpg`, keepRemote: false };
    },
  };
}

const draft = {
  name: "",
  description: "",
  productUrl: "https://shop.example/mic",
  imageSource: "auto" as const,
  customImageUrl: "",
  recommendedBy: "john" as const,
  sortOrder: null,
};

describe("tech page pictures", () => {
  it("picks og:image, then twitter:image, then a Product image, then the largest icon", () => {
    const base = "https://shop.example/mic";
    assert.equal(readPageMeta(PAGE, base).imageUrl, "https://cdn.example/og.jpg");
    assert.equal(readPageMeta(PAGE, base).title, "Desk Mic");
    assert.equal(readPageMeta(PAGE, base).description, "The one on the desk.");

    const noOg = PAGE.replace('content="https://cdn.example/og.jpg"', 'content=""');
    assert.equal(readPageMeta(noOg, base).imageUrl, "https://cdn.example/tw.jpg");

    const noTwitter = noOg.replace('content="https://cdn.example/tw.jpg"', 'content=""');
    assert.equal(readPageMeta(noTwitter, base).imageUrl, "https://cdn.example/product.jpg");

    const noProduct = noTwitter.replace(/<script[\s\S]*<\/script>/, "");
    assert.equal(readPageMeta(noProduct, base).imageUrl, "https://shop.example/icon.png");

    const touchOnly = noProduct.replace('sizes="512x512" href="/icon.png"', 'sizes="32x32" href="/icon.png"');
    assert.equal(readPageMeta(touchOnly, base).imageUrl, "https://shop.example/touch.png");
  });

  it("ignores a non-product image and resolves a relative og:image", () => {
    const html = `<meta property="og:image" content="/photos/mic.jpg?id=1&amp;v=2">
      <script type="application/ld+json">{"@type":"Article","image":"https://cdn.example/article.jpg"}</script>
      <link rel="icon" href="/favicon.ico">`;
    assert.deepEqual(readPageMeta(html, "https://shop.example/gear"), {
      title: null,
      description: null,
      imageUrl: "https://shop.example/photos/mic.jpg?id=1&v=2",
    });
    const graph = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebPage","image":"https://cdn.example/page.jpg"},{"@type":"Product","image":{"@type":"ImageObject","url":"https://cdn.example/object.jpg"}}]}
      </script>`;
    assert.equal(readPageMeta(graph, "https://shop.example/").imageUrl, "https://cdn.example/object.jpg");
  });

  it("keeps a custom picture when the product URL changes and can revert to the automatic one", () => {
    const previous = {
      imageUrl: "https://cdn.example/mine.jpg",
      imageSource: "custom" as const,
      autoImageUrl: "https://blob.example/old.jpg",
    };
    const changed = planTechImage({
      previous,
      urlChanged: true,
      requestedSource: "custom",
      customImageUrl: "https://cdn.example/mine.jpg",
      fetchedAutoUrl: "https://cdn.example/new.jpg",
    });
    assert.deepEqual(applyTechImagePlan(changed, "https://blob.example/new.jpg", false), {
      imageSource: "custom",
      imageUrl: "https://cdn.example/mine.jpg",
      autoImageUrl: "https://blob.example/new.jpg",
    });

    const failed = planTechImage({
      previous,
      urlChanged: true,
      requestedSource: "custom",
      customImageUrl: "https://cdn.example/mine.jpg",
      fetchedAutoUrl: null,
    });
    assert.equal(applyTechImagePlan(failed, null, false).imageUrl, "https://cdn.example/mine.jpg");
    assert.equal(applyTechImagePlan(failed, null, false).autoImageUrl, null);

    const reverted = planTechImage({
      previous: {
        imageUrl: "https://cdn.example/mine.jpg",
        imageSource: "custom",
        autoImageUrl: "https://blob.example/new.jpg",
      },
      urlChanged: false,
      requestedSource: "auto",
      customImageUrl: null,
      fetchedAutoUrl: undefined,
    });
    assert.deepEqual(applyTechImagePlan(reverted, null, false), {
      imageSource: "auto",
      imageUrl: "https://blob.example/new.jpg",
      autoImageUrl: "https://blob.example/new.jpg",
    });
  });

  it("fills an empty name from the page and leaves a typed name alone", () => {
    assert.deepEqual(
      mergeEmptyCopy({ name: "", description: "" }, { title: "Desk Mic", description: "On the desk.", imageUrl: null }),
      { name: "Desk Mic", description: "On the desk." },
    );
    assert.deepEqual(
      mergeEmptyCopy(
        { name: "My name", description: "My words" },
        { title: "Other", description: "Other words", imageUrl: null },
      ),
      { name: "My name", description: "My words" },
    );
  });
});

describe("tech writes", () => {
  it("uses the same admin rule as movies and tv", () => {
    for (const input of [
      { signedIn: false, role: "admin" },
      { signedIn: true, role: "listener" },
      { signedIn: true, role: null },
      { signedIn: true, role: "admin" },
    ]) {
      assert.deepEqual(techAdminDecision(input), mediaAdminDecision(input));
    }
  });

  it("rejects listeners and signed-out callers before any fetch or insert", async () => {
    for (const [role, userId, message] of [
      ["listener", "person", "Crew only."],
      [null, "", "Unauthorized"],
    ] as const) {
      const db = memoryDb(role);
      const client = io();
      await assert.rejects(() => saveTechProduct(db.sql, userId, draft, client), new RegExp(message));
      await assert.rejects(() => deleteTechProduct(db.sql, userId, PRODUCT), new RegExp(message));
      assert.equal(client.fetches.length, 0);
      assert.equal(client.copies.length, 0);
      assert.equal(db.rows.length, 0);
      assert.equal(db.calls.some((call) => call.startsWith("insert") || call.startsWith("delete")), false);
    }
  });

  it("rejects bad links, pictures, and sort orders", () => {
    const bad = (patch: Record<string, unknown>, message: RegExp) => {
      const parsed = parseTechInput({ ...draft, name: "Mic", ...patch });
      assert.equal("error" in parsed, true);
      if ("error" in parsed) assert.match(parsed.error, message);
    };
    bad({ productUrl: "javascript:alert(1)" }, /http\(s\) URL/);
    bad({ productUrl: "http://127.0.0.1/admin" }, /isn't allowed/);
    bad({ productUrl: "http://169.254.169.254/latest" }, /isn't allowed/);
    bad({ productUrl: "http://10.0.0.8/" }, /isn't allowed/);
    bad({ productUrl: "file:///etc/passwd" }, /http\(s\) URL/);
    bad(
      { imageSource: "custom", customImageUrl: "javascript:alert(1)" },
      /http\(s\) URL/,
    );
    bad({ imageSource: "custom", customImageUrl: "" }, /Add a picture/);
    bad({ sortOrder: 1.5 }, /whole number/);
    bad({ recommendedBy: "someone" }, /John, Dan, or both/);
    const ok = parseTechInput({ ...draft, name: "Mic", productUrl: "http://shop.example/mic" });
    assert.equal("error" in ok, false);
  });

  it("stores the copied automatic picture, then refuses to overwrite a custom one", async () => {
    const db = memoryDb("admin");
    const client = io();
    const created = await saveTechProduct(db.sql, ADMIN, draft, client);
    assert.equal(created.imageSource, "auto");
    assert.equal(created.name, "Fetched Mic");
    assert.equal(created.description, "A microphone.");
    assert.equal(created.imageUrl, "https://blob.example/1.jpg");
    assert.equal(created.recommendedBy, "john");
    assert.equal(client.copies[0], "https://cdn.example/auto.jpg");

    const custom = await saveTechProduct(
      db.sql,
      ADMIN,
      {
        id: created.id,
        name: "My mic",
        description: "The one I use.",
        productUrl: "https://shop.example/other",
        imageSource: "custom",
        customImageUrl: "https://cdn.example/mine.jpg",
        recommendedBy: "both",
        sortOrder: 4,
      },
      client,
    );
    assert.equal(custom.name, "My mic");
    assert.equal(custom.imageSource, "custom");
    assert.equal(custom.imageUrl, "https://cdn.example/mine.jpg");
    assert.equal(custom.autoImageUrl, "https://blob.example/2.jpg");
    assert.equal(custom.sortOrder, 4);
    assert.equal(db.rows.length, 1);

    const reverted = await saveTechProduct(
      db.sql,
      ADMIN,
      {
        id: created.id,
        name: "My mic",
        description: "The one I use.",
        productUrl: custom.productUrl,
        imageSource: "auto",
        customImageUrl: "",
        recommendedBy: "both",
        sortOrder: 4,
      },
      client,
    );
    assert.equal(reverted.imageSource, "auto");
    assert.equal(reverted.imageUrl, custom.autoImageUrl);
    assert.equal(client.fetches.length, 2);
  });

  it("does not fetch again when the URL is unchanged", async () => {
    const db = memoryDb("admin");
    const client = io();
    const created = await saveTechProduct(db.sql, ADMIN, { ...draft, name: "Mic" }, client);
    await saveTechProduct(
      db.sql,
      ADMIN,
      { ...draft, id: created.id, name: "Mic renamed", productUrl: created.productUrl },
      client,
    );
    assert.equal(client.fetches.length, 1);
    assert.equal(db.rows[0]?.name, "Mic renamed");
    assert.equal(db.rows[0]?.image_url, "https://blob.example/1.jpg");
  });
});

describe("tech fetch safety", () => {
  const lookup: PreviewLookup = async (hostname) => {
    if (hostname === "shop.example" || hostname === "cdn.example") {
      return [{ address: "93.184.216.34", family: 4 }];
    }
    if (hostname === "rebind.example") return [{ address: "10.1.1.1", family: 4 }];
    throw new Error(`unexpected lookup ${hostname}`);
  };

  it("blocks private, loopback, link-local, and metadata addresses after DNS", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.5",
      "192.168.0.2",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
    assert.equal(isBlockedIp("93.184.216.34"), false);
    for (const url of [
      "http://127.0.0.1/",
      "http://2130706433/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/",
      "http://metadata.google.internal/",
      "http://user:pass@shop.example/",
      "https://shop.example:8443/mic",
    ]) {
      assert.equal(publicHttpUrl(url), null, url);
    }
    assert.equal(publicHttpUrl("https://shop.example/mic")?.href, "https://shop.example/mic");
    await assert.rejects(
      () => fetchTechResource("http://rebind.example/secret", { maxBytes: 1000, lookup, request: async () => {
        throw new Error("should not dial");
      } }),
      /isn't allowed/,
    );
  });

  it("re-checks each redirect and stops after three", async () => {
    const calls: string[] = [];
    const request =
      (nextFor: (url: string, count: number) => string | null): PreviewRequest =>
      async (input) => {
        calls.push(input.url.href);
        const next = nextFor(input.url.href, calls.length);
        if (next) {
          return { status: 302, location: next, contentType: "text/html", body: new Uint8Array() };
        }
        return {
          status: 200,
          location: null,
          contentType: "text/html",
          body: new TextEncoder().encode("ok"),
        };
      };

    await assert.rejects(
      () =>
        fetchTechResource("http://shop.example/start", {
          maxBytes: 1000,
          lookup,
          request: request(() => "http://127.0.0.1/secret"),
        }),
      /Couldn't read that page/,
    );
    assert.deepEqual(calls, ["http://shop.example/start"]);

    calls.length = 0;
    const hops = ["http://shop.example/a", "http://shop.example/b", "http://shop.example/c"];
    const ok = await fetchTechResource("http://shop.example/start", {
      maxBytes: 1000,
      lookup,
      request: request((_url, count) => (count <= 3 ? hops[count - 1] ?? null : null)),
    });
    assert.equal(ok.finalUrl, "http://shop.example/c");
    assert.deepEqual(calls, [
      "http://shop.example/start",
      "http://shop.example/a",
      "http://shop.example/b",
      "http://shop.example/c",
    ]);

    calls.length = 0;
    await assert.rejects(
      () =>
        fetchTechResource("http://shop.example/start", {
          maxBytes: 1000,
          lookup,
          request: request(() => "http://shop.example/again"),
        }),
      /Couldn't read that page/,
    );
    assert.equal(calls.length, 2);
  });
});

describe("tech image bytes and migration", () => {
  it("accepts a real image under 5 MB and rejects the wrong type", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const ok = classifyImageBytes("image/png; charset=binary", png, png.byteLength);
    assert.equal(ok.ok, true);
    const html = new TextEncoder().encode("<html></html>");
    assert.equal(classifyImageBytes("image/jpeg", html, html.byteLength).ok, false);
    assert.equal(classifyImageBytes("image/svg+xml", png, png.byteLength).ok, false);
    assert.equal(classifyImageBytes("image/png", png, TECH_IMAGE_MAX_BYTES + 1).ok, false);
  });

  it("names client uploads under tech/ and matches the upload path", () => {
    const path = techBlobPathname("My Mic.PNG", new Date("2026-11-13T00:00:00.000Z"));
    assert.match(path, TECH_BLOB_PATH);
    assert.match(path, /^tech\/2026-11\//);
  });

  it("creates only tech_product, twice, and the runtime runner does not treat it as the rating rebuild", async () => {
    const sql = readFileSync(join(root, "migrations/0018_tech_product.sql"), "utf8");
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.match(statements, /create table if not exists tech_product/i);
    assert.match(statements, /create index if not exists/i);
    assert.doesNotMatch(statements, /alter table|media_item|media_rating|chat_message|four_up/i);
    const client = createClient({ url: ":memory:" });
    try {
      await applySqliteMigration(client, sql);
      await applySqliteMigration(client, sql);
      const file = { name: "0018_tech_product.sql", sql };
      await bootstrapSqliteSchema(client, [file]);
      await bootstrapSqliteSchema(client, [file]);
      const applied = await client.execute("select name from _migrations");
      assert.deepEqual(
        applied.rows.map((row) => String(row.name)),
        ["0018_tech_product.sql"],
      );
      const tables = await client.execute(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
      );
      assert.deepEqual(
        tables.rows.map((row) => String(row.name)),
        ["_migrations", "tech_product"],
      );
      const columns = await client.execute("PRAGMA table_info(tech_product)");
      const names = columns.rows.map((row) => String(row.name));
      for (const column of ["image_source", "auto_image_url", "recommended_by", "sort_order", "created_at", "updated_at"]) {
        assert.ok(names.includes(column), column);
      }
    } finally {
      client.close();
    }
  });

  it("is linked from the home tile, the sitemap, and the page head", () => {
    const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
    assert.match(sitemap, /https:\/\/www\.spacebatshow\.net\/tech/);
    const page = readFileSync(join(root, "src/routes/tech.tsx"), "utf8");
    assert.match(page, /TECH_PAGE_HEAD/);
    assert.match(page, /TECH_DESCRIPTION/);
    assert.match(page, /spacebat:og-url/);
    const desk = readFileSync(join(root, "src/components/tech-desk.tsx"), "utf8");
    assert.match(desk, /rel="noopener noreferrer"/);
    assert.doesNotMatch(desk, /nofollow|sponsored/);
    const header = readFileSync(join(root, "src/components/site-header.tsx"), "utf8");
    assert.doesNotMatch(header, /\/tech/);
    assert.match(desk, /Add product/);
    assert.match(desk, /No picture yet/);
  });
});

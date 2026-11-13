import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlockedAddressError, requestPublic } from "./link-preview-http.ts";
import {
  PREVIEW_FETCH_LIMIT,
  PREVIEW_MAX_BYTES,
  PREVIEW_MAX_REDIRECTS,
  PREVIEW_TIMEOUT_MS,
  consumePreviewBudget,
  isBlockedHostname,
  isBlockedIp,
  previewFromHtml,
  previewKey,
  publicHttpUrl,
  resolveLinkPreview,
  safeImageUrl,
  type PreviewDeps,
  type PreviewResponse,
} from "./link-preview.ts";
import { firstPreviewUrl, youtubeVideoId } from "./link-urls.ts";

const signal = () => new AbortController().signal;
const encoder = new TextEncoder();

function html(body: string, status = 200): PreviewResponse {
  return {
    status,
    location: null,
    contentType: "text/html; charset=utf-8",
    body: encoder.encode(body),
  };
}

function redirect(location: string): PreviewResponse {
  return { status: 302, location, contentType: "text/html", body: new Uint8Array() };
}

function harness(options: {
  pages?: Record<string, PreviewResponse>;
  ips?: Record<string, string[]>;
  onRequest?: (href: string, address: string) => PreviewResponse | null;
}) {
  const requests: Array<{ href: string; address: string }> = [];
  const lookups: string[] = [];
  const deps: PreviewDeps = {
    lookup: async (hostname) => {
      lookups.push(hostname);
      const list = options.ips?.[hostname] ?? ["93.184.216.34"];
      return list.map((address) => ({
        address,
        family: address.includes(":") ? (6 as const) : (4 as const),
      }));
    },
    request: async (input) => {
      requests.push({ href: input.url.href, address: input.address });
      const custom = options.onRequest?.(input.url.href, input.address);
      if (custom) return custom;
      return (
        options.pages?.[input.url.href] ?? {
          status: 404,
          location: null,
          contentType: "text/html",
          body: new Uint8Array(),
        }
      );
    },
  };
  return { deps, requests, lookups };
}

describe("first URL in a message", () => {
  it("uses the first http(s) URL and leaves trailing punctuation out", () => {
    assert.equal(firstPreviewUrl("see https://example.com/a. today"), "https://example.com/a");
    assert.equal(firstPreviewUrl("https://one.test/a https://two.test/b"), "https://one.test/a");
    assert.equal(firstPreviewUrl("www.example.com/x"), "https://www.example.com/x");
    assert.equal(firstPreviewUrl("http://example.com/a"), "http://example.com/a");
    assert.equal(
      firstPreviewUrl("see https://en.wikipedia.org/wiki/Bat_(animal) today"),
      "https://en.wikipedia.org/wiki/Bat_(animal)",
    );
  });

  it("ignores javascript and messages with no URL", () => {
    assert.equal(firstPreviewUrl("javascript:alert(1)"), null);
    assert.equal(firstPreviewUrl("no link here"), null);
    assert.equal(firstPreviewUrl(""), null);
  });

  it("recognizes YouTube watch, short, embed, and youtu.be links", () => {
    const id = "dQw4w9WgXcQ";
    assert.equal(youtubeVideoId(`https://youtu.be/${id}`), id);
    assert.equal(youtubeVideoId(`https://www.youtube.com/watch?v=${id}&t=4`), id);
    assert.equal(youtubeVideoId(`https://m.youtube.com/shorts/${id}`), id);
    assert.equal(youtubeVideoId(`https://www.youtube.com/embed/${id}`), id);
    assert.equal(youtubeVideoId(`https://www.youtube-nocookie.com/embed/${id}`), id);
    assert.equal(youtubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
    assert.equal(
      previewKey("https://youtu.be/dQw4w9WgXcQ"),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    assert.equal(
      previewKey("https://music.youtube.com/watch?v=dQw4w9WgXcQ"),
      previewKey("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    );
  });
});

describe("blocked hosts and addresses", () => {
  it("blocks private, loopback, link-local, and metadata addresses", () => {
    const blocked = [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "100.127.255.255",
      "127.0.0.1",
      "127.255.255.255",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.1",
      "192.0.2.1",
      "192.168.1.1",
      "198.18.0.1",
      "198.19.255.1",
      "198.51.100.1",
      "203.0.113.5",
      "224.0.0.1",
      "240.0.0.1",
      "255.255.255.255",
      "::",
      "::1",
      "fe80::1",
      "febf::1",
      "fc00::1",
      "fd12::1",
      "fec0::1",
      "ff02::1",
      "2001:db8::1",
      "2002:7f00:1::",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:10.0.0.1",
      "64:ff9b::127.0.0.1",
      "64:ff9b::169.254.169.254",
    ];
    for (const ip of blocked) assert.equal(isBlockedIp(ip), true, ip);

    const allowed = [
      "1.1.1.1",
      "8.8.8.8",
      "11.0.0.1",
      "100.63.255.255",
      "100.128.0.1",
      "126.0.0.1",
      "172.15.255.255",
      "172.32.0.1",
      "192.169.1.1",
      "198.20.0.1",
      "2606:4700:4700::1111",
      "::ffff:8.8.8.8",
      "64:ff9b::8.8.8.8",
    ];
    for (const ip of allowed) assert.equal(isBlockedIp(ip), false, ip);
    assert.equal(isBlockedIp("not-an-ip"), true);
  });

  it("blocks localhost, single-label, and metadata names", () => {
    for (const host of [
      "localhost",
      "localhost.",
      "foo.localhost",
      "printer.local",
      "db.internal",
      "metadata.google.internal",
      "metadata",
      "printer",
    ]) {
      assert.equal(isBlockedHostname(host), true, host);
    }
    assert.equal(isBlockedHostname("example.com"), false);
    assert.equal(isBlockedHostname("www.youtube.com"), false);
  });

  it("refuses non-http, userinfo, odd ports, and rewritten loopback literals", () => {
    assert.equal(publicHttpUrl("https://example.com/a")?.href, "https://example.com/a");
    assert.equal(publicHttpUrl("https://example.com./a#frag")?.href, "https://example.com/a");
    assert.equal(publicHttpUrl("https://8.8.8.8/dns")?.href, "https://8.8.8.8/dns");
    assert.equal(publicHttpUrl("ftp://example.com/"), null);
    assert.equal(publicHttpUrl("javascript:alert(1)"), null);
    assert.equal(publicHttpUrl("https://user:pass@example.com/"), null);
    assert.equal(publicHttpUrl("https://example.com:8443/"), null);
    assert.equal(publicHttpUrl("http://127.0.0.1/"), null);
    assert.equal(publicHttpUrl("http://2130706433/"), null);
    assert.equal(publicHttpUrl("http://0x7f000001/"), null);
    assert.equal(publicHttpUrl("http://0177.0.0.1/"), null);
    assert.equal(publicHttpUrl("http://127.1/"), null);
    assert.equal(publicHttpUrl("http://169.254.169.254/latest/meta-data/"), null);
    assert.equal(publicHttpUrl("http://[::1]/"), null);
    assert.equal(publicHttpUrl("http://localhost/secret"), null);
    assert.equal(publicHttpUrl("http://metadata.google.internal/"), null);
    assert.equal(PREVIEW_MAX_REDIRECTS, 3);
    assert.equal(PREVIEW_MAX_BYTES, 512 * 1024);
    assert.equal(PREVIEW_TIMEOUT_MS, 5_000);
  });

  it("does not open a socket to a blocked address or a non-default port", async () => {
    const blocked = ["169.254.169.254", "127.0.0.1", "::1", "10.0.0.1"];
    for (const address of blocked) {
      const url = address.includes(":") ? "http://[::1]/" : `http://${address}/`;
      await assert.rejects(
        async () =>
          requestPublic({
            url: new URL(url),
            address,
            family: address.includes(":") ? 6 : 4,
            accept: "text/html",
            signal: new AbortController().signal,
          }),
        (err: unknown) => err instanceof BlockedAddressError,
      );
    }
    await assert.rejects(
      async () =>
        requestPublic({
          url: new URL("http://example.com:81/"),
          address: "93.184.216.34",
          family: 4,
          accept: "text/html",
          signal: new AbortController().signal,
        }),
      (err: unknown) => err instanceof BlockedAddressError,
    );
  });
});

describe("preview fetch", () => {
  it("connects to the resolved address and reads Open Graph tags", async () => {
    const { deps, requests, lookups } = harness({
      ips: { "example.com": ["1.1.1.1"] },
      pages: {
        "https://example.com/post": html(`
          <html><head>
            <script><meta property="og:title" content="From script"></script>
            <meta property="og:site_name" content="SpaceBat">
            <meta content="Bats &amp; Caves" property="og:title">
            <meta property="og:description" content="A night in the cave">
            <meta property="og:image" content="/cover.png">
            <title>Ignored</title>
          </head></html>
        `),
      },
    });
    const preview = await resolveLinkPreview("https://example.com/post", deps, signal());
    assert.deepEqual(lookups, ["example.com"]);
    assert.deepEqual(requests, [{ href: "https://example.com/post", address: "1.1.1.1" }]);
    assert.equal(preview?.siteName, "SpaceBat");
    assert.equal(preview?.title, "Bats & Caves");
    assert.equal(preview?.description, "A night in the cave");
    assert.equal(preview?.image, "https://example.com/cover.png");
  });

  it("falls back to the title and the registrable host", async () => {
    const { deps } = harness({
      pages: {
        "https://www.example.com/a": html("<title>Hello &lt;b&gt;there&lt;/b&gt;</title>"),
      },
    });
    const preview = await resolveLinkPreview("https://www.example.com/a", deps, signal());
    assert.equal(preview?.title, "Hello there");
    assert.equal(preview?.siteName, "example.com");
    assert.equal(preview?.image, null);
  });

  it("returns null for non-html and for a page with no metadata", async () => {
    const { deps } = harness({
      pages: {
        "https://example.com/pic": {
          status: 200,
          location: null,
          contentType: "image/png",
          body: encoder.encode("<title>Nope</title>"),
        },
        "https://example.com/empty": html("<html><body>hi</body></html>"),
      },
    });
    assert.equal(await resolveLinkPreview("https://example.com/pic", deps, signal()), null);
    assert.equal(await resolveLinkPreview("https://example.com/empty", deps, signal()), null);
  });

  it("drops a private or non-http image and keeps the title", () => {
    const htmlDoc = `
      <meta property="og:title" content="Poster">
      <meta property="og:image" content="http://127.0.0.1/a.png">
    `;
    assert.equal(previewFromHtml(htmlDoc, "https://example.com/a")?.image, null);
    assert.equal(previewFromHtml(htmlDoc, "https://example.com/a")?.title, "Poster");
    assert.equal(safeImageUrl("javascript:alert(1)", "https://example.com/"), null);
    assert.equal(safeImageUrl("data:image/png;base64,aaaa", "https://example.com/"), null);
    assert.equal(
      safeImageUrl("//cdn.example.com/a.png", "https://example.com/post"),
      "https://cdn.example.com/a.png",
    );
    assert.equal(
      safeImageUrl("http://cdn.example.com/a.png", "https://example.com/"),
      "http://cdn.example.com/a.png",
    );
  });

  it("does not fetch a blocked host, and refuses a DNS answer that includes a private address", async () => {
    const local = harness({});
    assert.equal(await resolveLinkPreview("http://127.0.0.1/latest", local.deps, signal()), null);
    assert.equal(await resolveLinkPreview("http://localhost/x", local.deps, signal()), null);
    assert.equal(
      await resolveLinkPreview("http://metadata.google.internal/", local.deps, signal()),
      null,
    );
    assert.deepEqual(local.lookups, []);
    assert.deepEqual(local.requests, []);

    const mixed = harness({ ips: { "example.com": ["1.1.1.1", "10.0.0.1"] } });
    assert.equal(await resolveLinkPreview("https://example.com/", mixed.deps, signal()), null);
    assert.deepEqual(mixed.lookups, ["example.com"]);
    assert.deepEqual(mixed.requests, []);

    const down = harness({});
    down.deps.lookup = async () => {
      throw new Error("dns");
    };
    assert.equal(await resolveLinkPreview("https://example.com/", down.deps, signal()), null);
  });

  it("follows at most three redirects and re-checks each hop", async () => {
    const success = harness({
      pages: {
        "https://example.com/a": redirect("https://cdn.example.com/b"),
        "https://cdn.example.com/b": redirect("/c"),
        "https://cdn.example.com/c": redirect("https://cdn.example.com/d"),
        "https://cdn.example.com/d": html("<title>Landed</title>"),
      },
      ips: {
        "example.com": ["93.184.216.34"],
        "cdn.example.com": ["93.184.216.35"],
      },
    });
    const preview = await resolveLinkPreview("https://example.com/a", success.deps, signal());
    assert.equal(preview?.title, "Landed");
    assert.deepEqual(
      success.requests.map((hit) => hit.address),
      ["93.184.216.34", "93.184.216.35", "93.184.216.35", "93.184.216.35"],
    );

    const tooMany = harness({
      pages: {
        "https://example.com/a": redirect("https://example.com/b"),
        "https://example.com/b": redirect("https://example.com/c"),
        "https://example.com/c": redirect("https://example.com/d"),
        "https://example.com/d": redirect("https://example.com/e"),
        "https://example.com/e": html("<title>Too far</title>"),
      },
    });
    assert.equal(await resolveLinkPreview("https://example.com/a", tooMany.deps, signal()), null);
    assert.deepEqual(
      tooMany.requests.map((hit) => hit.href),
      [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
        "https://example.com/d",
      ],
    );

    const poisoned = harness({
      pages: {
        "https://example.com/a": redirect("http://169.254.169.254/latest/meta-data/"),
      },
    });
    assert.equal(await resolveLinkPreview("https://example.com/a", poisoned.deps, signal()), null);
    assert.equal(poisoned.requests.length, 1);

    const loop = harness({
      pages: { "https://example.com/a": redirect("https://example.com/a") },
    });
    assert.equal(await resolveLinkPreview("https://example.com/a", loop.deps, signal()), null);
    assert.equal(loop.requests.length, 1);
  });

  it("ignores metadata that starts past the byte cap", async () => {
    const late = harness({
      pages: {
        "https://example.com/big": html(`${"x".repeat(PREVIEW_MAX_BYTES)}<title>Late</title>`),
      },
    });
    assert.equal(await resolveLinkPreview("https://example.com/big", late.deps, signal()), null);

    const early = harness({
      pages: {
        "https://example.com/big": html(`<title>Early</title>${"x".repeat(PREVIEW_MAX_BYTES)}`),
      },
    });
    assert.equal(
      (await resolveLinkPreview("https://example.com/big", early.deps, signal()))?.title,
      "Early",
    );
  });

  it("uses YouTube oEmbed for the video title and thumbnail", async () => {
    const { deps, requests } = harness({
      onRequest: (href) => {
        const url = new URL(href);
        assert.equal(url.hostname, "www.youtube.com");
        assert.equal(url.pathname, "/oembed");
        assert.match(url.searchParams.get("url") ?? "", /dQw4w9WgXcQ/);
        return {
          status: 200,
          location: null,
          contentType: "application/json; charset=utf-8",
          body: encoder.encode(
            JSON.stringify({
              title: "Bat &amp; Cave",
              author_name: "SpaceBat",
              provider_name: "YouTube",
              thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            }),
          ),
        };
      },
    });
    const preview = await resolveLinkPreview("https://youtu.be/dQw4w9WgXcQ", deps, signal());
    assert.equal(requests[0]?.address, "93.184.216.34");
    assert.equal(preview?.siteName, "YouTube");
    assert.equal(preview?.title, "Bat & Cave");
    assert.equal(preview?.description, "SpaceBat");
    assert.equal(preview?.image, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("drops a YouTube thumbnail that is not a public http(s) URL", async () => {
    const { deps } = harness({
      onRequest: () => ({
        status: 200,
        location: null,
        contentType: "application/json",
        body: encoder.encode(
          JSON.stringify({
            title: "Night",
            thumbnail_url: "http://127.0.0.1/thumb.jpg",
          }),
        ),
      }),
    });
    const preview = await resolveLinkPreview(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      deps,
      signal(),
    );
    assert.equal(preview?.title, "Night");
    assert.equal(preview?.image, null);
  });

  it("returns null when the fetch throws", async () => {
    const { deps } = harness({});
    deps.request = async () => {
      throw new Error("boom");
    };
    assert.equal(await resolveLinkPreview("https://example.com/", deps, signal()), null);
  });
});

describe("preview rate limit", () => {
  it("allows the budget inside a minute and refuses the next fetch", () => {
    let stamps: number[] = [];
    for (let index = 0; index < PREVIEW_FETCH_LIMIT; index += 1) {
      const next = consumePreviewBudget(stamps, 5_000);
      assert.equal(next.allowed, true);
      stamps = next.stamps;
    }
    assert.equal(consumePreviewBudget(stamps, 5_000).allowed, false);
  });

  it("forgets a stamp after the window", () => {
    const first = consumePreviewBudget([], 0, 1, 1_000);
    assert.equal(first.allowed, true);
    assert.equal(consumePreviewBudget(first.stamps, 999, 1, 1_000).allowed, false);
    assert.equal(consumePreviewBudget(first.stamps, 1_000, 1, 1_000).allowed, true);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePublishedEpisodes } from "./podcast-feed.ts";

const nestedHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/einstein-nested-show-notes.html"),
  "utf8",
);

const NESTED_MUSE =
  `<li>Muse AI: <a href="https://muse.ai/" target="_blank">https://muse.ai/</a>` +
  `<ul><li>Dan's Referral Code: OFL3UD</li></ul></li>`;

const SIBLING_MUSE =
  `<li>Muse AI: <a href="https://muse.ai/" target="_blank">https://muse.ai/</a></li>` +
  `<ul><li>Dan's Referral Code: OFL3UD</li></ul>`;

// Podhome later flattened the sub-bullet into its own item and glued "Dan's"
// onto the parent URL.
const FLAT_MUSE =
  `<li>Muse AI: <a href="https://muse.ai/" target="_blank">https://muse.ai/</a></li>` +
  `<li><a href="https://muse.ai/Dan's" target="_blank">Dan's</a> Referral Code: OFL3UD</li>`;

function episodeFrom(html: string) {
  const episodes = parsePublishedEpisodes(`<rss><channel><item>
    <title>Einstein vs AI, Road Rage, Amazon: Where Superheroes Go To Die</title>
    <guid>notes-1</guid>
    <pubDate>Thu, 29 Oct 2026 00:30:00 GMT</pubDate>
    <enclosure url="https://serve.podhome.fm/episode/notes-1.mp3" />
    <content:encoded><![CDATA[${html}]]></content:encoded>
  </item></channel></rss>`);
  const episode = episodes[0];
  if (!episode) throw new Error("expected an episode");
  return episode;
}

function hrefs(links: { href: string; children?: { href: string }[] }[]): string[] {
  return links.flatMap((link) => [link.href, ...hrefs(link.children ?? [])]);
}

test("a nested list in the middle keeps later notes under the parent", () => {
  assert.equal(nestedHtml.includes(NESTED_MUSE), true);
  const episode = episodeFrom(nestedHtml);
  const { paragraphs, links } = episode.notes;

  assert.equal(paragraphs[0]?.startsWith("In episode five"), true);
  assert.equal(
    paragraphs.some((paragraph) => paragraph.includes("BioShock, and Fantastic Four")),
    true,
  );
  assert.equal(episode.description.includes("https://"), false);
  assert.equal(episode.description.includes("BioShock official links"), false);
  assert.equal(episode.description.includes("Grok by xAI"), false);

  const muse = links.find((link) => link.label === "Muse AI");
  const museAt = links.findIndex((link) => link.label === "Muse AI");
  assert.ok(muse);
  assert.equal(muse.href, "https://muse.ai/");
  assert.deepEqual(muse.children, [{ label: "Dan's Referral Code: OFL3UD", href: "" }]);
  assert.equal(links[museAt + 1]?.label, "Grok by xAI");
  assert.equal(links[museAt + 1]?.href, "https://docs.x.ai/grok/overview");
  assert.equal(links.at(-1)?.label, "BioShock official links");
  assert.equal(links.at(-1)?.href, "https://linktr.ee/bioshock");
  assert.equal(
    links.some((link) => link.label.includes("Referral Code")),
    false,
  );
  assert.equal(
    hrefs(links).some((href) => href.includes("Dan's") || href.includes("OFL3UD")),
    false,
  );
});

test("a nested list renders the same when it is a sibling ul or a flattened bogus href", () => {
  const nested = episodeFrom(nestedHtml).notes;
  const sibling = episodeFrom(nestedHtml.replace(NESTED_MUSE, SIBLING_MUSE)).notes;
  const flattened = episodeFrom(nestedHtml.replace(NESTED_MUSE, FLAT_MUSE)).notes;
  assert.deepEqual(sibling, nested);
  assert.deepEqual(flattened, nested);
});

test("a real nested link stays a link when its path extends the parent", () => {
  const episode = episodeFrom(`<p>Tools.</p><ul>
    <li>Muse AI: <a href="https://muse.ai/">https://muse.ai/</a>
      <ul><li>Pricing: <a href="https://muse.ai/pricing">https://muse.ai/pricing</a></li></ul>
    </li>
    <li>Grok by xAI: <a href="https://docs.x.ai/grok/overview">https://docs.x.ai/grok/overview</a></li>
  </ul>`);
  const [muse, grok] = episode.notes.links;
  assert.equal(muse?.label, "Muse AI");
  assert.deepEqual(muse?.children, [{ label: "Pricing", href: "https://muse.ai/pricing" }]);
  assert.equal(grok?.label, "Grok by xAI");
  assert.equal(episode.description, "Tools.");
});

test("a flat list keeps every link and leaves the prose alone", () => {
  const episode = episodeFrom(`<p>We talked about the week.</p>
    <ul>
      <li>Apple: <a href="https://www.apple.com/" target="_blank">https://www.apple.com/</a></li>
      <li>NASA: <a href="https://www.nasa.gov/a?x=1&amp;y=2" target="_blank">https://www.nasa.gov/a?x=1&amp;y=2</a></li>
      <li>No link here</li>
      <li>Meta AI Cap Raise <a href="https://example.com/a">https://example.com/a</a><br /> <a href="https://example.com/b">https://example.com/b</a></li>
    </ul>`);
  assert.deepEqual(episode.notes.paragraphs, ["We talked about the week."]);
  assert.deepEqual(episode.notes.links, [
    { label: "Apple", href: "https://www.apple.com/" },
    { label: "NASA", href: "https://www.nasa.gov/a?x=1&y=2" },
    { label: "Meta AI Cap Raise", href: "https://example.com/a" },
  ]);
  assert.equal(episode.description.includes("https://"), false);
});

test("a description with no list is prose and has no show notes", () => {
  const episode = episodeFrom("<p>First paragraph.</p><br /><br />Second paragraph.");
  assert.deepEqual(episode.notes, {
    paragraphs: ["First paragraph.", "Second paragraph."],
    links: [],
  });
  assert.equal(episode.description, "First paragraph.\n\nSecond paragraph.");
});

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkHtmlLinksAndTrailing,
  extractHtmlLinks,
} from "./check-links.js";

async function withFiles(files, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "check-links-"));
  for (const [name, value] of Object.entries(files)) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value);
  }
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const hrefs = (links) => links.map((link) => link.href);

test("extractHtmlLinks reads quoted and minified unquoted values", () => {
  const html = [
    "<a href=/docs/foo>a</a>",
    "<a href='/docs/bar'>b</a>",
    '<a href="/docs/baz">c</a>',
    '<a href="/docs/qux?label=&quot;x&quot;&amp;lang=en">d</a>',
  ].join("");
  assert.deepEqual(hrefs(extractHtmlLinks(html)), [
    "/docs/foo",
    "/docs/bar",
    "/docs/baz",
    '/docs/qux?label="x"&lang=en',
  ]);
});

test("extractHtmlLinks skips an unquoted protocol-relative URL", () => {
  const html = "<a href=//cdn.example.com/x>x</a><a href=/docs/keep>keep</a>";
  assert.deepEqual(hrefs(extractHtmlLinks(html)), ["/docs/keep"]);
});

test("extractHtmlLinks ignores escaped attributes in embedded JSON", () => {
  const html = '<div data-props=\'{"html":"<a href=\\"#\\">example</a>"}\'></div>';
  assert.deepEqual(extractHtmlLinks(html), []);
});

test("checkHtmlLinksAndTrailing checks unquoted paths and ids", async () => {
  await withFiles(
    {
      "docs/a/index.html": [
        "<a href=/docs/b#bindings-images>good</a>",
        "<a href=/docs/b#images>bad-anchor</a>",
        "<a href=/docs/gone#anything>bad-path</a>",
      ].join(""),
      "docs/b/index.html": "<h3 id=bindings-images>Images</h3>",
    },
    async (root) => {
      const result = await checkHtmlLinksAndTrailing(root, root, "/", []);
      assert.deepEqual(hrefs(result.broken), ["/docs/gone#anything"]);
      assert.deepEqual(hrefs(result.anchors), ["/docs/b#images"]);
    },
  );
});

test("checkHtmlLinksAndTrailing decodes entities in unquoted ids", async () => {
  await withFiles(
    {
      "docs/a/index.html": "<a href=/docs/b#section%26details>good</a>",
      "docs/b/index.html": "<h2 id=section&amp;details>Details</h2>",
    },
    async (root) => {
      const result = await checkHtmlLinksAndTrailing(root, root, "/", []);
      assert.deepEqual(result.broken, []);
      assert.deepEqual(result.anchors, []);
    },
  );
});

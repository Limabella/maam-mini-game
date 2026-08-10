import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders The Curator's Lie restaurant case", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>K-Memorial — The Curator(?:'|&#x27;)s Lie<\/title>/i);
  assert.match(html, /Five Regions, One Borrowed Room/);
  assert.match(html, /Exactly one statement is false/);
  assert.match(html, /ENTER THE ARCHIVE/);
  assert.equal((html.match(/aria-label="Inspect [^"]+"/g) ?? []).length, 5);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships five restaurant scenes and deterministic evidence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Chuncheon Dakgalbi Hall/);
  assert.match(page, /forged: true/);
  assert.match(page, /Every authentic room bears exactly three memory seals/);
  assert.match(page, /Busan.*cobalt tile/s);
  assert.match(page, /item\.seals\.map/);
  assert.match(page, /type="range"/);
  assert.match(page, /ACCUSE THIS ROOM/);
  const assets = ["01-jeonju-bibimbap.png", "02-busan-gukbap.png", "03-jeju-black-pork.png", "04-andong-jjimdak.png", "05-chuncheon-dakgalbi.png"].map((name) => new URL(`../public/assets/restaurants/${name}`, import.meta.url));
  await Promise.all([...assets, new URL("../public/og.png", import.meta.url)].map(access));
});

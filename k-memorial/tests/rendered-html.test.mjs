import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders The Curator's Lie case", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>K-Memorial — The Curator(?:'|&#x27;)s Lie<\/title>/i);
  assert.match(html, /THE CURATOR(?:'|&#x27;)S LIE/);
  assert.match(html, /Five Seasons, One Intruder/);
  assert.match(html, /Exactly one statement is false/);
  assert.match(html, /ENTER THE GALLERY/);

  const inspectionLabels = html.match(/aria-label="Inspect [^"]+"/g) ?? [];
  assert.equal(inspectionLabels.length, 5);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships five gallery works and deterministic evidence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Crimson Eclipse/);
  assert.match(page, /forged: true/);
  assert.match(page, /Every authentic work bears exactly three memory seals/);
  assert.match(page, /artwork\.seals\.map/);
  assert.match(page, /type="range"/);
  assert.match(page, /ACCUSE THIS WORK/);

  const assets = [
    "01-spring-dawn.png",
    "02-summer-lotus.png",
    "03-autumn-persimmon.png",
    "04-winter-moon.png",
    "05-crimson-eclipse.png",
  ].map((name) => new URL(`../public/assets/gallery/${name}`, import.meta.url));

  await Promise.all([...assets, new URL("../public/og.png", import.meta.url)].map(access));
});

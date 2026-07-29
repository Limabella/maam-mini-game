import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Jeonju hidden-object game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>K-Memorial — Hidden Table<\/title>/i);
  assert.match(html, /Jeonju Bibimbap House/);
  assert.match(html, /Hongdong-Baekseo/);
  assert.match(html, /BASIC COLLECTION/);
  assert.match(
    html,
    /\/assets\/backgrounds\/jeonju-bibimbap-restaurant-empty\.png/,
  );

  const hiddenLabels = html.match(/aria-label="Hidden [^"]+"/g) ?? [];
  assert.equal(hiddenLabels.length, 5);
  assert.match(html, /Hidden Jujube/);
  assert.match(html, /Hidden Chestnut/);
  assert.match(html, /Hidden Korean Pear/);
  assert.match(html, /Hidden Persimmon/);
  assert.match(html, /Hidden Apple/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the required game assets and maker roadmap", async () => {
  const [page, plan, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/product-plan-ko.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Memory Map/);
  assert.match(page, /magnifier-lens/);
  assert.match(page, /LENS_ZOOM/);
  assert.match(page, /Maker players/);
  assert.match(plan, /30개 모두 가로형 16:9, 동일한 시점과 품질/);
  assert.match(plan, /원본 배경과 음식 오브젝트를 완전히 별도 레이어로 관리/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  const assets = [
    "../public/assets/backgrounds/jeonju-bibimbap-restaurant-empty.png",
    "../public/assets/collectibles/jujube.png",
    "../public/assets/collectibles/chestnut.png",
    "../public/assets/collectibles/pear.png",
    "../public/assets/collectibles/persimmon.png",
    "../public/assets/collectibles/apple.png",
    "../public/og.png",
  ];
  await Promise.all(assets.map((asset) => access(new URL(asset, import.meta.url))));
});

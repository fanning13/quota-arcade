import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.mjs";
test("serves app entry and module, blocks escaping the public directory", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<!doctype html>/i);
    const module = await fetch(base + "/core.js");
    assert.match(module.headers.get("content-type"), /javascript/);
    assert.equal((await fetch(base + "/%2e%2e%2fpackage.json")).status, 404);
    assert.equal((await fetch(base, { method: "POST" })).status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

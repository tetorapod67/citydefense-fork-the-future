import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production build contains login, play, and preview metadata", async () => {
  const worker = await readFile(
    new URL("../dist/server/index.js", import.meta.url),
    "utf8",
  );

  assert.match(worker, /"codex-preview":\s*"development"/);
  assert.match(worker, /pattern:\s*"\/login"/);
  assert.match(worker, /pattern:\s*"\/play"/);
  assert.match(worker, /Enter the active Seat/);
});

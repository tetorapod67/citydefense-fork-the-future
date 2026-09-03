import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships top-level login and play routes with D1 enabled", async () => {
  const [wrangler, login, play, client] = await Promise.all([
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("src/app/login/page.tsx", root), "utf8"),
    readFile(new URL("src/app/play/page.tsx", root), "utf8"),
    readFile(new URL("src/app/play/city-defense-client.tsx", root), "utf8"),
  ]);
  const config = JSON.parse(wrangler);
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.match(login, /LoginForm/);
  assert.match(play, /CityDefenseClient/);
  assert.match(client, /document\.modelContext/);
  assert.doesNotMatch(`${play}\n${client}`, /iframe/i);
});

test("registers exactly the two Gate 1 Site Tools", async () => {
  const source = await readFile(new URL("src/app/play/city-defense-client.tsx", root), "utf8");
  const names = [...source.matchAll(/name:\s*"([a-z0-9_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ["get_city_context", "place_stamp_bundle"]);
  assert.equal((source.match(/registerTool\(/g) ?? []).length, 2);
  assert.match(source, /additionalProperties:\s*false/g);
  assert.match(source, /readOnlyHint:\s*true/);
  assert.match(source, /readOnlyHint:\s*false/);
});

test("keeps Gate 2 and Dispatcher runtime out of the implementation", async () => {
  const [server, client] = await Promise.all([
    readFile(new URL("src/app/server/city-defense.ts", root), "utf8"),
    readFile(new URL("src/app/play/city-defense-client.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(`${server}\n${client}`, /DISPATCHER-01|Phaser|create_branch|replay_branch/);
});

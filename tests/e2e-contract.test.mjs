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
  assert.match(source, /core_stamp_type_id:\s*\{\s*type:\s*"string",\s*enum:\s*\["STAMP_CONFIRM"\]/);
  assert.match(source, /items:\s*\{\s*type:\s*"string",\s*enum:\s*\["district:CENTRAL_WARD"\]/);
  assert.match(source, /scope:\s*\{\s*type:\s*"string",\s*enum:\s*\["BRANCH_PUBLIC"\]/);
  assert.doesNotMatch(source, /SEAT_PRIVATE|modifier_stamp_type_ids|reply_to_stamp_id|expires_after_ticks/);
});

test("references accepted P0 proof assets without the image optimizer", async () => {
  const client = await readFile(
    new URL("src/app/play/city-defense-client.tsx", root),
    "utf8",
  );
  const assetPaths = [
    "assets/p0/buildings/com_market_hall.png",
    "assets/p0/buildings/civ_town_hall.png",
    "assets/p0/map/road_one_lane_local__m1111_nesw.png",
    "assets/p0/buildings/def_sensor_mast.png",
    "assets/p0/signals/stamp_confirm.png",
  ];

  assert.doesNotMatch(client, /from\s+["']next\/image["']/);
  assert.equal(
    (client.match(/src="\/assets\/p0\/signals\/stamp_confirm\.png"/g) ?? []).length,
    2,
  );
  assert.match(
    client,
    /className="stamp-marker"[\s\S]{0,200}<img src="\/assets\/p0\/signals\/stamp_confirm\.png"/,
  );
  assert.match(
    client,
    /className="activity-icon"[\s\S]{0,200}<img src="\/assets\/p0\/signals\/stamp_confirm\.png"/,
  );

  await Promise.all(
    assetPaths.map(async (assetPath) => {
      assert.ok(client.includes(`/${assetPath}`), `${assetPath}: source reference missing`);
      const image = await readFile(new URL(`public/${assetPath}`, root));
      assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.ok(image.readUInt32BE(16) > 0, `${assetPath}: width must be positive`);
      assert.ok(image.readUInt32BE(20) > 0, `${assetPath}: height must be positive`);
    }),
  );
});

test("keeps Gate 2 and Dispatcher runtime out of the implementation", async () => {
  const [server, client] = await Promise.all([
    readFile(new URL("src/app/server/city-defense.ts", root), "utf8"),
    readFile(new URL("src/app/play/city-defense-client.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(`${server}\n${client}`, /DISPATCHER-01|Phaser|create_branch|replay_branch/);
});

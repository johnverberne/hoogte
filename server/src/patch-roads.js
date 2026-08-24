import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRoads } from "./fetchMap.js";
import { MAP_REGIONS } from "./mapRegions.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data/maps");

for (const region of MAP_REGIONS) {
  console.log(`Wegen ${region.name}…`);
  const roads = await fetchRoads(region);
  const file = path.join(dir, `${region.id}.json`);
  const payload = JSON.parse(await readFile(file, "utf8"));
  payload.roads = roads;
  await writeFile(file, JSON.stringify(payload));
  console.log(`  ${region.id}: ${roads.length} wegen`);
}

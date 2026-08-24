import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRegion, MAP_REGIONS } from "./mapRegions.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data/maps");
const cache = new Map();

export async function loadMap(id) {
  const region = getRegion(id);
  if (cache.has(region.id)) return cache.get(region.id);
  const file = path.join(dir, `${region.id}.json`);
  const raw = JSON.parse(await readFile(file, "utf8"));
  cache.set(region.id, raw);
  return raw;
}

export function listMaps() {
  return MAP_REGIONS;
}

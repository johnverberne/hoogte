import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchElevationGrid, fetchRoads } from "./fetchMap.js";
import { MAP_REGIONS } from "./mapRegions.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data/maps");
await mkdir(dir, { recursive: true });

for (const region of MAP_REGIONS) {
  console.log(`Ophalen ${region.name}…`);
  const grid = await fetchElevationGrid(region);
  console.log(`  hoogte ${grid.min.toFixed(0)}–${grid.max.toFixed(0)} m`);
  let roads = [];
  try {
    roads = await fetchRoads(region);
  } catch (error) {
    console.warn(`  wegen overgeslagen: ${error.message}`);
  }
  const payload = {
    id: region.id,
    name: region.name,
    country: region.country,
    blurb: region.blurb,
    bounds: {
      south: region.south,
      west: region.west,
      north: region.north,
      east: region.east,
    },
    cols: grid.cols,
    rows: grid.rows,
    min: grid.min,
    max: grid.max,
    elevation: grid.elevation,
    roads,
  };
  const file = path.join(dir, `${region.id}.json`);
  await writeFile(file, JSON.stringify(payload));
  console.log(
    `  ${region.id}: ${grid.cols}x${grid.rows} hoogte ${grid.min.toFixed(0)}–${grid.max.toFixed(0)} m, ${roads.length} wegen`
  );
}

console.log("Kaarten klaar.");

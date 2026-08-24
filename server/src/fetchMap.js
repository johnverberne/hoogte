import { PNG } from "pngjs";

const GRID = 56;

export async function fetchElevationGrid(region) {
  const zoom = 10;
  const x0 = Math.floor(lonToTile(region.west, zoom));
  const x1 = Math.floor(lonToTile(region.east, zoom));
  const y0 = Math.floor(latToTile(region.north, zoom));
  const y1 = Math.floor(latToTile(region.south, zoom));
  const tiles = new Map();

  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      tiles.set(`${x},${y}`, await fetchTerrariumTile(zoom, x, y));
    }
  }

  const cols = GRID;
  const rows = GRID;
  const elevation = [];
  let min = Infinity;
  let max = -Infinity;

  for (let j = 0; j < rows; j += 1) {
    const lat = region.south + ((region.north - region.south) * j) / (rows - 1);
    for (let i = 0; i < cols; i += 1) {
      const lon = region.west + ((region.east - region.west) * i) / (cols - 1);
      const fx = lonToTile(lon, zoom);
      const fy = latToTile(lat, zoom);
      const tx = Math.floor(fx);
      const ty = Math.floor(fy);
      const tile = tiles.get(`${tx},${ty}`);
      const z = tile ? sampleTile(tile, fx - tx, fy - ty) : 0;
      elevation.push(z);
      if (z < min) min = z;
      if (z > max) max = z;
    }
  }

  return { cols, rows, elevation, min, max };
}

export async function fetchRoads(region) {
  const query = `[out:json][timeout:40];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${region.south},${region.west},${region.north},${region.east});
);
out geom;`;

  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  let data = null;
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
      if (data?.elements) break;
    } catch (error) {
      console.warn(`Overpass ${endpoint}: ${error.message}`);
      data = null;
    }
  }
  if (!data?.elements) return [];

  const width = region.east - region.west || 1;
  const height = region.north - region.south || 1;
  const roads = [];

  for (const element of data.elements) {
    const geom = element.geometry;
    if (!Array.isArray(geom) || geom.length < 2) continue;
    const line = [];
    for (const point of geom) {
      const u = (point.lon - region.west) / width;
      const v = (point.lat - region.south) / height;
      if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) continue;
      const prev = line[line.length - 1];
      if (prev && Math.hypot(u - prev[0], v - prev[1]) < 0.004) continue;
      line.push([round4(u), round4(v)]);
    }
    if (line.length >= 2) roads.push(line);
    if (roads.length >= 180) break;
  }

  return roads;
}

async function fetchTerrariumTile(z, x, y) {
  const urls = [
    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
    `https://tile.nextzen.org/tilezen/terrain/v1/256/terrarium/${z}/${x}/${y}.png`,
  ];
  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      return PNG.sync.read(buffer);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function sampleTile(tile, u, v) {
  const x = Math.min(tile.width - 1, Math.max(0, Math.round(u * (tile.width - 1))));
  const y = Math.min(tile.height - 1, Math.max(0, Math.round(v * (tile.height - 1))));
  const idx = (tile.width * y + x) << 2;
  const r = tile.data[idx];
  const g = tile.data[idx + 1];
  const b = tile.data[idx + 2];
  return r * 256 + g + b / 256 - 32768;
}

function lonToTile(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}

function latToTile(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

async function postForm(url, body, tries) {
  let lastError;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
    }
  }
  throw lastError;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

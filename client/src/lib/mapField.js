export const MAP_REGIONS = [
  {
    id: "limburg",
    name: "Zuid-Limburg",
    country: "Nederland",
    blurb: "Heuvels rond Vaals en Gulpen, met wegen.",
  },
  {
    id: "interlaken",
    name: "Berner Oberland",
    country: "Zwitserland",
    blurb: "Alpenreliëf rond Interlaken.",
  },
  {
    id: "geiranger",
    name: "Geirangerfjord",
    country: "Noorwegen",
    blurb: "Diep fjord met steile wanden.",
  },
];

export function defaultMapParams() {
  return {
    mapRegion: "limburg",
    mapRoads: true,
    mapContours: true,
    roadHeightMm: 0.7,
    roadWidthMm: 1.2,
    mapRevision: 0,
  };
}

export function clampMapParams(raw = {}) {
  const ids = MAP_REGIONS.map((region) => region.id);
  return {
    mapRegion: ids.includes(raw.mapRegion) ? raw.mapRegion : "limburg",
    mapRoads: raw.mapRoads !== false,
    mapContours: raw.mapContours !== false,
    roadHeightMm: clamp(num(raw.roadHeightMm, 0.7), 0, 4),
    roadWidthMm: clamp(num(raw.roadWidthMm, 1.2), 0.4, 4),
    mapRevision: Math.max(0, Math.round(num(raw.mapRevision, 0))),
  };
}

export function mapRaisedMm(params) {
  if (params.mode !== "map" || (!params.mapRoads && !params.mapContours)) return 0;
  return Number(params.roadHeightMm) || 0;
}

let activeMap = null;

export function setActiveMap(data) {
  activeMap = data;
}

export function getActiveMap() {
  return activeMap;
}

export function buildMapField(params) {
  const n = params.resolution;
  const field = new Float32Array(n * n);
  const map = activeMap || syntheticMap();
  const cols = map.cols;
  const rows = map.rows;
  const range = map.max - map.min || 1;

  for (let j = 0; j < n; j += 1) {
    const v = n === 1 ? 0.5 : j / (n - 1);
    for (let i = 0; i < n; i += 1) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const z = (sampleGrid(map.elevation, cols, rows, u, v) - map.min) / range;
      const nx = u - 0.5;
      const ny = v - 0.5;
      const r = Math.hypot(nx, ny);
      const damp = 1 - params.falloff * (r / 0.5 / Math.SQRT2) ** 2;
      field[j * n + i] = z * params.waveHeightMm * Math.max(0, damp);
    }
  }

  const lines = [];
  if (params.mapRoads) lines.push(...(map.roads?.length ? map.roads : inventRoads(map)));
  if (params.mapContours) lines.push(...buildContours(map, 7));
  if (lines.length) {
    const mask = rasterizeRoads(lines, n, params.roadWidthMm, params.sizeMm);
    const height = Number(params.roadHeightMm) || 0;
    for (let k = 0; k < field.length; k += 1) {
      field[k] += mask[k] * height;
    }
  }

  return field;
}

function sampleGrid(values, cols, rows, u, v) {
  const x = clamp(u, 0, 1) * (cols - 1);
  const y = clamp(v, 0, 1) * (rows - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = values[y0 * cols + x0];
  const b = values[y0 * cols + x1];
  const c = values[y1 * cols + x0];
  const d = values[y1 * cols + x1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function rasterizeRoads(roads, n, widthMm, sizeMm) {
  const mask = new Float32Array(n * n);
  const radius = Math.max(0.6, (widthMm / sizeMm) * n * 0.5);

  for (const line of roads) {
    for (let i = 1; i < line.length; i += 1) {
      const [u0, v0] = line[i - 1];
      const [u1, v1] = line[i];
      const x0 = u0 * (n - 1);
      const y0 = v0 * (n - 1);
      const x1 = u1 * (n - 1);
      const y1 = v1 * (n - 1);
      const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        stamp(mask, n, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
      }
    }
  }
  return mask;
}

function inventRoads(map) {
  const { elevation, cols, rows } = map;
  const seeds = [];
  const gw = Math.floor(cols / 4);
  const gh = Math.floor(rows / 4);
  for (let gj = 0; gj < 4; gj += 1) {
    for (let gi = 0; gi < 4; gi += 1) {
      let best = null;
      for (let j = gj * gh; j < Math.min(rows, (gj + 1) * gh); j += 1) {
        for (let i = gi * gw; i < Math.min(cols, (gi + 1) * gw); i += 1) {
          const s = cellSlope(elevation, cols, rows, i, j);
          if (!best || s < best.slope) best = { i, j, slope: s };
        }
      }
      if (best) seeds.push(best);
    }
  }

  const roads = [];
  for (let a = 0; a < seeds.length; a += 1) {
    const others = seeds
      .map((seed, index) => ({ seed, index, d: Math.hypot(seed.i - seeds[a].i, seed.j - seeds[a].j) }))
      .filter((item) => item.index !== a)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2);
    for (const item of others) {
      if (item.index < a) continue;
      const line = walkLowSlope(elevation, cols, rows, seeds[a], item.seed);
      if (line.length >= 2) roads.push(line);
    }
  }
  return roads;
}

function walkLowSlope(elevation, cols, rows, start, end) {
  const line = [];
  let i = start.i;
  let j = start.j;
  for (let step = 0; step < 80; step += 1) {
    line.push([i / (cols - 1), j / (rows - 1)]);
    if (i === end.i && j === end.j) break;
    let next = null;
    for (let dj = -1; dj <= 1; dj += 1) {
      for (let di = -1; di <= 1; di += 1) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const remain = Math.hypot(end.i - ni, end.j - nj);
        const slope = cellSlope(elevation, cols, rows, ni, nj);
        const score = remain + slope * 0.05;
        if (!next || score < next.score) next = { i: ni, j: nj, score };
      }
    }
    if (!next || (next.i === i && next.j === j)) break;
    i = next.i;
    j = next.j;
  }
  return line;
}

function cellSlope(elevation, cols, rows, i, j) {
  const x0 = elevation[j * cols + Math.max(0, i - 1)];
  const x1 = elevation[j * cols + Math.min(cols - 1, i + 1)];
  const y0 = elevation[Math.max(0, j - 1) * cols + i];
  const y1 = elevation[Math.min(rows - 1, j + 1) * cols + i];
  return Math.hypot(x1 - x0, y1 - y0);
}

function buildContours(map, levels) {
  const { elevation, cols, rows, min, max } = map;
  const range = max - min || 1;
  const lines = [];
  for (let level = 1; level <= levels; level += 1) {
    const threshold = min + (range * level) / (levels + 1);
    for (let j = 0; j < rows - 1; j += 1) {
      for (let i = 0; i < cols - 1; i += 1) {
        const z00 = elevation[j * cols + i];
        const z10 = elevation[j * cols + i + 1];
        const z01 = elevation[(j + 1) * cols + i];
        const z11 = elevation[(j + 1) * cols + i + 1];
        const bits =
          (z00 >= threshold ? 1 : 0) +
          (z10 >= threshold ? 2 : 0) +
          (z11 >= threshold ? 4 : 0) +
          (z01 >= threshold ? 8 : 0);
        const edge = contourEdge(bits, i, j, z00, z10, z01, z11, threshold, cols, rows);
        if (edge) lines.push(edge);
      }
    }
  }
  return lines;
}

function contourEdge(bits, i, j, z00, z10, z01, z11, threshold, cols, rows) {
  if (bits === 0 || bits === 15) return null;
  const lerp = (a, b) => (threshold - a) / ((b - a) || 1);
  const top = [i + lerp(z00, z10), j];
  const right = [i + 1, j + lerp(z10, z11)];
  const bottom = [i + lerp(z01, z11), j + 1];
  const left = [i, j + lerp(z00, z01)];
  const pairs = {
    1: [left, top],
    2: [top, right],
    3: [left, right],
    4: [right, bottom],
    5: [left, top],
    6: [top, bottom],
    7: [left, bottom],
    8: [bottom, left],
    9: [bottom, top],
    10: [top, right],
    11: [bottom, right],
    12: [right, left],
    13: [bottom, top],
    14: [right, left],
  };
  const pair = pairs[bits];
  if (!pair) return null;
  return pair.map(([x, y]) => [x / (cols - 1), y / (rows - 1)]);
}

function stamp(mask, n, x, y, radius) {
  const r = Math.ceil(radius + 0.5);
  const x0 = Math.max(0, Math.floor(x - r));
  const x1 = Math.min(n - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r));
  const y1 = Math.min(n - 1, Math.ceil(y + r));
  for (let j = y0; j <= y1; j += 1) {
    for (let i = x0; i <= x1; i += 1) {
      const d = Math.hypot(i - x, j - y);
      if (d > radius) continue;
      const value = 1 - d / radius;
      const idx = j * n + i;
      if (value > mask[idx]) mask[idx] = value;
    }
  }
}

function syntheticMap() {
  const cols = 48;
  const rows = 48;
  const elevation = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const u = i / (cols - 1);
      const v = j / (rows - 1);
      elevation.push(
        80 +
          140 * Math.exp(-((u - 0.72) ** 2 + (v - 0.38) ** 2) * 8) +
          90 * Math.exp(-((u - 0.35) ** 2 + (v - 0.7) ** 2) * 10) +
          18 * Math.sin(u * 9) * Math.cos(v * 7)
      );
    }
  }
  return {
    id: "synthetic",
    cols,
    rows,
    min: 80,
    max: 230,
    elevation,
    roads: [
      [[0.05, 0.18], [0.42, 0.28], [0.7, 0.22], [0.95, 0.3]],
      [[0.12, 0.82], [0.38, 0.58], [0.62, 0.48], [0.88, 0.62]],
      [[0.28, 0.08], [0.33, 0.4], [0.3, 0.78]],
    ],
  };
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

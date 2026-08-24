import { cloneParams, defaultParams } from "./wave.js";

const STORAGE_KEY = "hoogte-patterns";

export function starterPatterns() {
  return [
    { id: "starter-interference", ...cloneParams(defaultParams()), name: "Interferentie", mode: "interference", harmonicCount: 3 },
    {
      id: "starter-radial",
      ...cloneParams(defaultParams()),
      name: "Radiale rimpel",
      mode: "radial",
      harmonicCount: 4,
      wavelengthScale: 1.15,
      falloff: 0.05,
      twist: 12,
    },
    {
      id: "starter-standing",
      ...cloneParams(defaultParams()),
      name: "Staande golf",
      mode: "standing",
      harmonicCount: 2,
      waveHeightMm: 10,
      wavelengthScale: 0.85,
    },
    {
      id: "starter-limburg",
      ...cloneParams(defaultParams()),
      name: "Zuid-Limburg",
      mode: "map",
      mapRegion: "limburg",
      waveHeightMm: 12,
      falloff: 0.08,
      resolution: 140,
    },
  ];
}

export async function fetchMap(id) {
  return request(`/api/maps/${id}`);
}

async function request(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Verzoek mislukt (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getHealth() {
  try {
    return await request("/api/health");
  } catch {
    return { ok: false, mongo: false };
  }
}

export async function listPatterns() {
  try {
    const remote = await request("/api/patterns");
    writeLocal(remote);
    return { items: remote, source: "mongo" };
  } catch {
    return { items: readLocal(), source: "local" };
  }
}

export async function savePattern(params, id) {
  try {
    const saved = id
      ? await request(`/api/patterns/${id}`, { method: "PUT", body: JSON.stringify(params) })
      : await request("/api/patterns", { method: "POST", body: JSON.stringify(params) });
    upsertLocal(saved);
    return { item: saved, source: "mongo" };
  } catch (error) {
    const local = {
      id: id || `local-${Date.now()}`,
      ...params,
      updatedAt: new Date().toISOString(),
    };
    upsertLocal(local);
    return { item: local, source: "local", warning: error.message };
  }
}

export async function deletePattern(id) {
  try {
    await request(`/api/patterns/${id}`, { method: "DELETE" });
  } catch {
    // local fallback still removes it
  }
  writeLocal(readLocal().filter((item) => item.id !== id));
}

function readLocal() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // ignore broken local cache
  }
  const seeded = starterPatterns();
  writeLocal(seeded);
  return seeded;
}

function writeLocal(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function upsertLocal(item) {
  const items = readLocal().filter((entry) => entry.id !== item.id);
  items.unshift(item);
  writeLocal(items);
}

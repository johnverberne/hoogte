import { applyTextRelief, defaultTextParams, textRaisedMm } from "./textField.js";

export const MODES = [
  { id: "interference", label: "Interferentie" },
  { id: "radial", label: "Radiaal" },
  { id: "standing", label: "Staande golf" },
];

export function defaultParams() {
  return {
    name: "Nieuw patroon",
    harmonicCount: 3,
    harmonics: defaultHarmonics(),
    wavelengthScale: 1,
    amplitudeScale: 1,
    sizeMm: 120,
    waveHeightMm: 8,
    baseThicknessMm: 2.4,
    falloff: 0.18,
    resolution: 90,
    mode: "interference",
    twist: 0,
    ...defaultTextParams(),
  };
}

export function defaultHarmonics() {
  return [
    { amplitude: 1, wavelength: 42, angle: 0, phase: 0, offset: 0 },
    { amplitude: 0.58, wavelength: 23, angle: 48, phase: 0.45, offset: 28 },
    { amplitude: 0.36, wavelength: 14, angle: 112, phase: 1.15, offset: 34 },
    { amplitude: 0.24, wavelength: 9, angle: 74, phase: 0.8, offset: 22 },
    { amplitude: 0.16, wavelength: 6.2, angle: 158, phase: 0.25, offset: 40 },
    { amplitude: 0.11, wavelength: 4.1, angle: 160, phase: 1.55, offset: 18 },
  ];
}

export function cloneParams(params) {
  const fallback = defaultHarmonics();
  return {
    ...params,
    harmonics: params.harmonics.map((h, i) => ({
      ...fallback[i],
      ...h,
      offset: Number(h.offset) || 0,
    })),
  };
}

export function radialOrigin(harmonic, params) {
  const theta = ((Number(harmonic.angle) + Number(params.twist || 0)) * Math.PI) / 180;
  const offset = Number(harmonic.offset) || 0;
  return [offset * Math.cos(theta), offset * Math.sin(theta)];
}

export function sampleHeight(nx, ny, params) {
  const x = nx * params.sizeMm;
  const y = ny * params.sizeMm;
  const r = Math.hypot(x, y);
  const rMax = params.sizeMm * 0.5 * Math.SQRT2;
  let z = 0;

  for (let i = 0; i < params.harmonicCount; i += 1) {
    const h = params.harmonics[i];
    const amplitude = h.amplitude * params.amplitudeScale;
    const wavelength = Math.max(0.8, h.wavelength * params.wavelengthScale);
    const theta = ((h.angle + params.twist) * Math.PI) / 180;
    const k = (2 * Math.PI) / wavelength;
    const phase = h.phase;

    if (params.mode === "radial") {
      const [cx, cy] = radialOrigin(h, params);
      z += amplitude * Math.sin(k * Math.hypot(x - cx, y - cy) + phase);
    } else if (params.mode === "standing") {
      const u = x * Math.cos(theta) + y * Math.sin(theta);
      const v = -x * Math.sin(theta) + y * Math.cos(theta);
      z += amplitude * Math.sin(k * u + phase) * Math.cos(k * v * 0.62);
    } else {
      const u = x * Math.cos(theta) + y * Math.sin(theta);
      z += amplitude * Math.sin(k * u + phase);
    }
  }

  const damp = 1 - params.falloff * (r / rMax) ** 2;
  return z * Math.max(0, damp);
}

export function buildHeightField(params) {
  const n = params.resolution;
  const field = new Float32Array(n * n);
  let min = Infinity;
  let max = -Infinity;

  for (let j = 0; j < n; j += 1) {
    const ny = n === 1 ? 0 : j / (n - 1) - 0.5;
    for (let i = 0; i < n; i += 1) {
      const nx = n === 1 ? 0 : i / (n - 1) - 0.5;
      const z = sampleHeight(nx, ny, params);
      field[j * n + i] = z;
      if (z < min) min = z;
      if (z > max) max = z;
    }
  }

  const range = max - min || 1;
  for (let k = 0; k < field.length; k += 1) {
    field[k] = ((field[k] - min) / range) * params.waveHeightMm;
  }

  applyTextRelief(field, params);
  return field;
}

export function meshStats(params) {
  const n = params.resolution;
  const top = (n - 1) * (n - 1) * 2;
  const triangles = top * 2 + (n - 1) * 8;
  const bytes = 84 + triangles * 50;
  return {
    triangles,
    fileKb: Math.round(bytes / 1024),
    widthMm: round1(params.sizeMm),
    depthMm: round1(params.sizeMm),
    heightMm: round1(params.baseThicknessMm + params.waveHeightMm + textRaisedMm(params)),
  };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

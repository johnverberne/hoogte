export const TEXT_MODES = [
  { id: "raise", label: "Verhoogd" },
  { id: "engrave", label: "Verdiept" },
];

export function defaultTextParams() {
  return {
    text: "",
    textSizeMm: 22,
    textHeightMm: 1.8,
    textOffsetX: 0,
    textOffsetY: 0,
    textRotation: 0,
    textMode: "raise",
  };
}

export function clampTextParams(raw = {}, sizeMm = 120) {
  const half = sizeMm * 0.45;
  return {
    text: String(raw.text ?? "").slice(0, 80),
    textSizeMm: clamp(num(raw.textSizeMm, 22), 6, 80),
    textHeightMm: clamp(num(raw.textHeightMm, 1.8), 0.4, 8),
    textOffsetX: clamp(num(raw.textOffsetX, 0), -half, half),
    textOffsetY: clamp(num(raw.textOffsetY, 0), -half, half),
    textRotation: clamp(num(raw.textRotation, 0), 0, 360),
    textMode: raw.textMode === "engrave" ? "engrave" : "raise",
  };
}

export function textRaisedMm(params) {
  if (!String(params.text || "").trim() || params.textMode === "engrave") return 0;
  return Number(params.textHeightMm) || 0;
}

export function applyTextRelief(field, params) {
  const mask = rasterizeText(params);
  if (!mask) return field;

  const height = Number(params.textHeightMm) || 0;
  const engrave = params.textMode === "engrave";
  for (let k = 0; k < field.length; k += 1) {
    const m = mask[k];
    if (m <= 0) continue;
    field[k] = engrave ? Math.max(0, field[k] - m * height) : field[k] + m * height;
  }
  return field;
}

const cache = { key: "", mask: null };

function rasterizeText(params) {
  const text = String(params.text || "").replace(/\r/g, "").trimEnd();
  if (!text.trim()) return null;

  const n = params.resolution;
  const key = [
    text,
    n,
    params.sizeMm,
    params.textSizeMm,
    params.textOffsetX,
    params.textOffsetY,
    params.textRotation,
  ].join("|");
  if (cache.key === key) return cache.mask;

  const canvas = makeCanvas(n * 3, n * 3);
  if (!canvas) {
    cache.key = key;
    cache.mask = null;
    return null;
  }

  const scale = 3;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const width = n * scale;
  const height = n * scale;
  const pxPerMm = width / params.sizeMm;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.translate(params.textOffsetX * pxPerMm, -params.textOffsetY * pxPerMm);
  ctx.rotate((-params.textRotation * Math.PI) / 180);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.max(8, params.textSizeMm * pxPerMm)}px Soleil, "Segoe UI", sans-serif`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0.04em";

  const lines = text.split("\n").slice(0, 4);
  const lineHeight = params.textSizeMm * pxPerMm * 1.15;
  const startY = -((lines.length - 1) * lineHeight) / 2;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], 0, startY + i * lineHeight);
  }
  ctx.restore();

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const mask = new Float32Array(n * n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      let sum = 0;
      const sy = (n - 1 - j) * scale;
      const sx = i * scale;
      for (let oy = 0; oy < scale; oy += 1) {
        for (let ox = 0; ox < scale; ox += 1) {
          sum += pixels[((sy + oy) * width + (sx + ox)) * 4];
        }
      }
      mask[j * n + i] = sum / (255 * scale * scale);
    }
  }

  cache.key = key;
  cache.mask = mask;
  return mask;
}

function makeCanvas(width, height) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas === "function") {
    try {
      return new OffscreenCanvas(width, height);
    } catch {
      return null;
    }
  }
  return null;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

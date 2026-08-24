import { buildHeightField } from "./wave.js";

export function buildPrintableStl(params) {
  const n = params.resolution;
  const size = params.sizeMm;
  const base = params.baseThicknessMm;
  const field = buildHeightField(params);
  const cells = n - 1;
  const triangleCount = cells * cells * 4 + cells * 8;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const header = "captainjohn.nl print relief to stl";

  for (let i = 0; i < header.length; i += 1) {
    view.setUint8(i, header.charCodeAt(i));
  }
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  const writeTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(offset, nx / len, true);
    view.setFloat32(offset + 4, ny / len, true);
    view.setFloat32(offset + 8, nz / len, true);
    writeVertex(view, offset + 12, ax, ay, az);
    writeVertex(view, offset + 24, bx, by, bz);
    writeVertex(view, offset + 36, cx, cy, cz);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  };

  const xy = (i, j) => {
    const x = n === 1 ? 0 : (i / (n - 1) - 0.5) * size;
    const y = n === 1 ? 0 : (j / (n - 1) - 0.5) * size;
    return [x, y];
  };
  const topZ = (i, j) => base + field[j * n + i];

  for (let j = 0; j < cells; j += 1) {
    for (let i = 0; i < cells; i += 1) {
      const [x00, y00] = xy(i, j);
      const [x10, y10] = xy(i + 1, j);
      const [x01, y01] = xy(i, j + 1);
      const [x11, y11] = xy(i + 1, j + 1);
      const z00 = topZ(i, j);
      const z10 = topZ(i + 1, j);
      const z01 = topZ(i, j + 1);
      const z11 = topZ(i + 1, j + 1);

      writeTri(x00, y00, z00, x10, y10, z10, x11, y11, z11);
      writeTri(x00, y00, z00, x11, y11, z11, x01, y01, z01);
      writeTri(x00, y00, 0, x11, y11, 0, x10, y10, 0);
      writeTri(x00, y00, 0, x01, y01, 0, x11, y11, 0);
    }
  }

  for (let i = 0; i < cells; i += 1) {
    wallQuad(writeTri, xy, topZ, i, 0, i + 1, 0);
    wallQuad(writeTri, xy, topZ, i + 1, cells, i, cells);
    wallQuad(writeTri, xy, topZ, 0, i + 1, 0, i);
    wallQuad(writeTri, xy, topZ, cells, i, cells, i + 1);
  }

  return buffer;
}

export function downloadStl(params) {
  const buffer = buildPrintableStl(params);
  const blob = new Blob([buffer], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(params.name)}.stl`;
  a.click();
  URL.revokeObjectURL(url);
}

function wallQuad(writeTri, xy, topZ, i0, j0, i1, j1) {
  const [x0, y0] = xy(i0, j0);
  const [x1, y1] = xy(i1, j1);
  const z0 = topZ(i0, j0);
  const z1 = topZ(i1, j1);
  writeTri(x0, y0, 0, x1, y1, 0, x1, y1, z1);
  writeTri(x0, y0, 0, x1, y1, z1, x0, y0, z0);
}

function writeVertex(view, offset, x, y, z) {
  view.setFloat32(offset, x, true);
  view.setFloat32(offset + 4, y, true);
  view.setFloat32(offset + 8, z, true);
}

function slug(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "print-relief"
  );
}

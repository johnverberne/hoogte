import { buildHeightField } from "./wave.js";

export function buildPrintableStl(params) {
  const n = params.resolution;
  const size = params.sizeMm;
  const base = params.baseThicknessMm;
  const field = buildHeightField(params);
  const cells = n - 1;
  const topTris = cells * cells * 2;
  const bottomTris = topTris;
  const wallTris = cells * 8;
  const triangleCount = topTris + bottomTris + wallTris;
  const buffer = Buffer.alloc(84 + triangleCount * 50);

  buffer.write("captainjohn.nl print relief to stl", 0, "ascii");
  buffer.writeUInt32LE(triangleCount, 80);

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
    nx /= len;
    ny /= len;
    nz /= len;
    buffer.writeFloatLE(nx, offset);
    buffer.writeFloatLE(ny, offset + 4);
    buffer.writeFloatLE(nz, offset + 8);
    writeVertex(buffer, offset + 12, ax, ay, az);
    writeVertex(buffer, offset + 24, bx, by, bz);
    writeVertex(buffer, offset + 36, cx, cy, cz);
    buffer.writeUInt16LE(0, offset + 48);
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
    wallQuad(writeTri, xy, topZ, i, 0, i + 1, 0, false);
    wallQuad(writeTri, xy, topZ, i + 1, cells, i, cells, false);
    wallQuad(writeTri, xy, topZ, 0, i + 1, 0, i, false);
    wallQuad(writeTri, xy, topZ, cells, i, cells, i + 1, false);
  }

  return buffer;
}

function wallQuad(writeTri, xy, topZ, i0, j0, i1, j1) {
  const [x0, y0] = xy(i0, j0);
  const [x1, y1] = xy(i1, j1);
  const z0 = topZ(i0, j0);
  const z1 = topZ(i1, j1);
  writeTri(x0, y0, 0, x1, y1, 0, x1, y1, z1);
  writeTri(x0, y0, 0, x1, y1, z1, x0, y0, z0);
}

function writeVertex(buffer, offset, x, y, z) {
  buffer.writeFloatLE(x, offset);
  buffer.writeFloatLE(y, offset + 4);
  buffer.writeFloatLE(z, offset + 8);
}

import { clampParams, defaultParams, meshStats } from "./wave.js";
import { buildPrintableStl } from "./stl.js";

for (const mode of ["interference", "radial", "standing"]) {
  const params = clampParams({ ...defaultParams(), mode });
  const stl = buildPrintableStl(params);
  const stats = meshStats(params);
  checkStl(stl, stats, mode);
}

const multiRadial = clampParams({
  ...defaultParams(),
  mode: "radial",
  harmonicCount: 4,
});
checkStl(buildPrintableStl(multiRadial), meshStats(multiRadial), "radial-4");

function checkStl(stl, stats, mode) {
  const triangles = stl.readUInt32LE(80);
  const expectedBytes = 84 + triangles * 50;

  if (triangles !== stats.triangles) {
    throw new Error(`${mode}: driehoekentelling ${triangles} vs ${stats.triangles}`);
  }
  if (stl.length !== expectedBytes) {
    throw new Error(`${mode}: bestandsgrootte ${stl.length} vs ${expectedBytes}`);
  }

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < triangles; i += 1) {
    const offset = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v += 1) {
      const z = stl.readFloatLE(offset + v * 12 + 8);
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  if (minZ !== 0) {
    throw new Error(`${mode}: onderkant moet op 0 mm liggen, kreeg ${minZ}`);
  }
  if (Math.abs(maxZ - stats.heightMm) > 0.15) {
    throw new Error(`${mode}: hoogte ${maxZ} wijkt af van ${stats.heightMm}`);
  }

  console.log(
    `STL ok (${mode}): ${triangles} driehoeken, ${stats.widthMm}x${stats.depthMm}x${maxZ.toFixed(1)} mm`
  );
}

import { Router } from "express";
import { Pattern } from "../models/Pattern.js";
import { buildPrintableStl } from "../stl.js";
import { clampParams, meshStats } from "../wave.js";

export const patternsRouter = Router();

patternsRouter.get("/", async (_req, res) => {
  const items = await Pattern.find().sort({ updatedAt: -1 }).lean();
  res.json(items.map(toClient));
});

patternsRouter.get("/:id", async (req, res) => {
  const item = await Pattern.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: "Patroon niet gevonden" });
  res.json(toClient(item));
});

patternsRouter.post("/", async (req, res) => {
  const params = clampParams(req.body);
  const created = await Pattern.create(params);
  res.status(201).json(toClient(created.toObject()));
});

patternsRouter.put("/:id", async (req, res) => {
  const params = clampParams(req.body);
  const updated = await Pattern.findByIdAndUpdate(req.params.id, params, {
    new: true,
    runValidators: true,
  }).lean();
  if (!updated) return res.status(404).json({ error: "Patroon niet gevonden" });
  res.json(toClient(updated));
});

patternsRouter.delete("/:id", async (req, res) => {
  const deleted = await Pattern.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Patroon niet gevonden" });
  res.status(204).end();
});

patternsRouter.post("/:id/stl", async (req, res) => {
  const item = await Pattern.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: "Patroon niet gevonden" });
  const params = clampParams(item);
  const stl = buildPrintableStl(params);
  const stats = meshStats(params);
  const filename = `${slug(params.name)}.stl`;
  res.setHeader("Content-Type", "model/stl");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Hoogte-Triangles", String(stats.triangles));
  res.send(stl);
});

function toClient(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    harmonicCount: doc.harmonicCount,
    harmonics: doc.harmonics,
    wavelengthScale: doc.wavelengthScale,
    amplitudeScale: doc.amplitudeScale,
    sizeMm: doc.sizeMm,
    waveHeightMm: doc.waveHeightMm,
    baseThicknessMm: doc.baseThicknessMm,
    falloff: doc.falloff,
    resolution: doc.resolution,
    mode: doc.mode,
    twist: doc.twist,
    text: doc.text ?? "",
    textSizeMm: doc.textSizeMm ?? 22,
    textHeightMm: doc.textHeightMm ?? 1.8,
    textOffsetX: doc.textOffsetX ?? 0,
    textOffsetY: doc.textOffsetY ?? 0,
    textRotation: doc.textRotation ?? 0,
    textMode: doc.textMode ?? "raise",
    mapRegion: doc.mapRegion ?? "limburg",
    mapRoads: doc.mapRoads !== false,
    mapContours: doc.mapContours !== false,
    roadHeightMm: doc.roadHeightMm ?? 0.7,
    roadWidthMm: doc.roadWidthMm ?? 1.2,
    updatedAt: doc.updatedAt,
  };
}

function slug(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "print-relief"
  );
}

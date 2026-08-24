import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pattern } from "./models/Pattern.js";
import { patternsRouter } from "./routes/patterns.js";
import { listMaps, loadMap } from "./mapStore.js";
import { defaultParams } from "./wave.js";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

const PORT = Number(process.env.PORT || 3001);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hoogte";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  res.json({ ok: true, mongo });
});

app.get("/api/maps", (_req, res) => {
  res.json(listMaps());
});

app.get("/api/maps/:id", async (req, res) => {
  try {
    res.json(await loadMap(req.params.id));
  } catch {
    res.status(404).json({ error: "Kaart niet gevonden" });
  }
});

app.use("/api/patterns", async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "MongoDB is niet verbonden. Start `docker compose up -d` of een lokale Mongo.",
    });
  }
  return next();
});

app.use("/api/patterns", patternsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Onverwachte serverfout" });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
    await seedIfEmpty();
    console.log("MongoDB verbonden");
  } catch (error) {
    console.warn("MongoDB niet bereikbaar:", error.message);
    console.warn("De editor werkt, opslaan in de cloud pas na het starten van Mongo.");
  }

  app.listen(PORT, () => {
    console.log(`print relief to stl API op http://localhost:${PORT}`);
  });
}

async function seedIfEmpty() {
  const count = await Pattern.countDocuments();
  if (count > 0) return;

  await Pattern.insertMany([
    {
      ...defaultParams(),
      name: "Interferentie",
      mode: "interference",
      harmonicCount: 3,
    },
    {
      ...defaultParams(),
      name: "Radiale rimpel",
      mode: "radial",
      harmonicCount: 3,
      wavelengthScale: 1.15,
      falloff: 0.05,
      twist: 12,
    },
    {
      ...defaultParams(),
      name: "Staande golf",
      mode: "standing",
      harmonicCount: 2,
      waveHeightMm: 10,
      wavelengthScale: 0.85,
    },
    {
      ...defaultParams(),
      name: "Zuid-Limburg",
      mode: "map",
      mapRegion: "limburg",
      waveHeightMm: 12,
      falloff: 0.08,
      resolution: 140,
    },
  ]);
}

start();

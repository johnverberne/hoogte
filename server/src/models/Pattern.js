import mongoose from "mongoose";

const harmonicSchema = new mongoose.Schema(
  {
    amplitude: { type: Number, required: true },
    wavelength: { type: Number, required: true },
    angle: { type: Number, required: true },
    phase: { type: Number, required: true },
    offset: { type: Number, default: 0 },
  },
  { _id: false }
);

const patternSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    harmonicCount: { type: Number, required: true },
    harmonics: { type: [harmonicSchema], required: true },
    wavelengthScale: { type: Number, required: true },
    amplitudeScale: { type: Number, required: true },
    sizeMm: { type: Number, required: true },
    waveHeightMm: { type: Number, required: true },
    baseThicknessMm: { type: Number, required: true },
    falloff: { type: Number, required: true },
    resolution: { type: Number, required: true },
    mode: { type: String, required: true },
    twist: { type: Number, required: true },
    text: { type: String, default: "", maxlength: 80 },
    textSizeMm: { type: Number, default: 22 },
    textHeightMm: { type: Number, default: 1.8 },
    textOffsetX: { type: Number, default: 0 },
    textOffsetY: { type: Number, default: 0 },
    textRotation: { type: Number, default: 0 },
    textMode: { type: String, default: "raise" },
    mapRegion: { type: String, default: "limburg" },
    mapRoads: { type: Boolean, default: true },
    mapContours: { type: Boolean, default: true },
    roadHeightMm: { type: Number, default: 0.7 },
    roadWidthMm: { type: Number, default: 1.2 },
  },
  { timestamps: true }
);

export const Pattern = mongoose.model("Pattern", patternSchema);

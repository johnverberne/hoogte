export const MAP_REGIONS = [
  {
    id: "limburg",
    name: "Zuid-Limburg",
    country: "Nederland",
    blurb: "Heuvels rond Vaals en Gulpen, met wegen.",
    south: 50.73,
    west: 5.72,
    north: 50.9,
    east: 6.02,
  },
  {
    id: "interlaken",
    name: "Berner Oberland",
    country: "Zwitserland",
    blurb: "Alpenreliëf rond Interlaken.",
    south: 46.52,
    west: 7.78,
    north: 46.7,
    east: 8.06,
  },
  {
    id: "geiranger",
    name: "Geirangerfjord",
    country: "Noorwegen",
    blurb: "Diep fjord met steile wanden.",
    south: 62.07,
    west: 7.05,
    north: 62.16,
    east: 7.28,
  },
];

export function getRegion(id) {
  return MAP_REGIONS.find((region) => region.id === id) || MAP_REGIONS[0];
}

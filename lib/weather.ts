export type City = { id: string; lat: number; lon: number };

/** Fixed city list; coordinates rounded to 4 decimals (MET Norway terms). */
export const CITIES: City[] = [
  { id: "damascus", lat: 33.5138, lon: 36.2765 },
  { id: "aleppo", lat: 36.2021, lon: 37.1343 },
  { id: "helsinki", lat: 60.1699, lon: 24.9384 },
  { id: "cairo", lat: 30.0444, lon: 31.2357 },
  { id: "riyadh", lat: 24.7136, lon: 46.6753 },
  { id: "dubai", lat: 25.2048, lon: 55.2708 },
  { id: "amman", lat: 31.9539, lon: 35.9106 },
  { id: "beirut", lat: 33.8938, lon: 35.5018 },
  { id: "istanbul", lat: 41.0082, lon: 28.9784 },
  { id: "berlin", lat: 52.52, lon: 13.405 },
];

export const DEFAULT_CITY = "damascus";

export type Weather = { city: string; temp: number; symbol: string; time: string };

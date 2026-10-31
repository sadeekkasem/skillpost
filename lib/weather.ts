export type Region = "arab" | "europe" | "namerica";
export type City = { id: string; region: Region; lat: number; lon: number };

export const REGIONS: Region[] = ["arab", "europe", "namerica"];

/** Fixed city list; coordinates rounded to 4 decimals (MET Norway terms). */
export const CITIES: City[] = [
  { id: "damascus", region: "arab", lat: 33.5138, lon: 36.2765 },
  { id: "aleppo", region: "arab", lat: 36.2021, lon: 37.1343 },
  { id: "cairo", region: "arab", lat: 30.0444, lon: 31.2357 },
  { id: "riyadh", region: "arab", lat: 24.7136, lon: 46.6753 },
  { id: "dubai", region: "arab", lat: 25.2048, lon: 55.2708 },
  { id: "amman", region: "arab", lat: 31.9539, lon: 35.9106 },
  { id: "beirut", region: "arab", lat: 33.8938, lon: 35.5018 },
  { id: "istanbul", region: "europe", lat: 41.0082, lon: 28.9784 },
  { id: "london", region: "europe", lat: 51.5074, lon: -0.1278 },
  { id: "vienna", region: "europe", lat: 48.2082, lon: 16.3738 },
  { id: "brussels", region: "europe", lat: 50.8503, lon: 4.3517 },
  { id: "sofia", region: "europe", lat: 42.6977, lon: 23.3219 },
  { id: "zagreb", region: "europe", lat: 45.815, lon: 15.9819 },
  { id: "nicosia", region: "europe", lat: 35.1856, lon: 33.3823 },
  { id: "prague", region: "europe", lat: 50.0755, lon: 14.4378 },
  { id: "copenhagen", region: "europe", lat: 55.6761, lon: 12.5683 },
  { id: "tallinn", region: "europe", lat: 59.437, lon: 24.7536 },
  { id: "helsinki", region: "europe", lat: 60.1699, lon: 24.9384 },
  { id: "paris", region: "europe", lat: 48.8566, lon: 2.3522 },
  { id: "berlin", region: "europe", lat: 52.52, lon: 13.405 },
  { id: "athens", region: "europe", lat: 37.9838, lon: 23.7275 },
  { id: "budapest", region: "europe", lat: 47.4979, lon: 19.0402 },
  { id: "dublin", region: "europe", lat: 53.3498, lon: -6.2603 },
  { id: "rome", region: "europe", lat: 41.9028, lon: 12.4964 },
  { id: "riga", region: "europe", lat: 56.9496, lon: 24.1052 },
  { id: "vilnius", region: "europe", lat: 54.6872, lon: 25.2797 },
  { id: "luxembourg", region: "europe", lat: 49.6116, lon: 6.1319 },
  { id: "valletta", region: "europe", lat: 35.8989, lon: 14.5146 },
  { id: "amsterdam", region: "europe", lat: 52.3676, lon: 4.9041 },
  { id: "warsaw", region: "europe", lat: 52.2297, lon: 21.0122 },
  { id: "lisbon", region: "europe", lat: 38.7223, lon: -9.1393 },
  { id: "bucharest", region: "europe", lat: 44.4268, lon: 26.1025 },
  { id: "bratislava", region: "europe", lat: 48.1486, lon: 17.1077 },
  { id: "ljubljana", region: "europe", lat: 46.0569, lon: 14.5058 },
  { id: "madrid", region: "europe", lat: 40.4168, lon: -3.7038 },
  { id: "stockholm", region: "europe", lat: 59.3293, lon: 18.0686 },
  { id: "washington", region: "namerica", lat: 38.9072, lon: -77.0369 },
  { id: "ottawa", region: "namerica", lat: 45.4215, lon: -75.6972 },
];

export const DEFAULT_CITY = "damascus";

export type Weather = { city: string; temp: number; symbol: string; time: string };

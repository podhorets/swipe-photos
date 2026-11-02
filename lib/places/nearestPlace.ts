import { CITIES } from '@/lib/places/cities';

export interface Place {
  /** Null when no listed city is close enough — only the country is known */
  city: string | null;
  country: string;
}

// Within this distance a photo counts as "in" the city
const CITY_KM = 40;
// Beyond this the nearest listed city says nothing reliable about the country
const COUNTRY_KM = 500;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Nearest listed place for a coordinate — computed on the device, no network. */
export function nearestPlace(lat: number, lon: number): Place | null {
  let best: (typeof CITIES)[number] | null = null;
  let bestKm = Infinity;
  for (const city of CITIES) {
    const km = distanceKm(lat, lon, city[2], city[3]);
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  if (!best || bestKm > COUNTRY_KM) return null;
  return { city: bestKm <= CITY_KM ? best[0] : null, country: best[1] };
}

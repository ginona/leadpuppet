export interface LocationBias {
  lat: number;
  lng: number;
  radiusMeters: number;
}

const DEFAULT_RADIUS_METERS = 40000;

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  houston: { lat: 29.7604, lng: -95.3698 },
  dallas: { lat: 32.7767, lng: -96.797 },
  atlanta: { lat: 33.749, lng: -84.388 },
  charlotte: { lat: 35.2271, lng: -80.8431 },
  nashville: { lat: 36.1627, lng: -86.7816 },
  tampa: { lat: 27.9506, lng: -82.4572 },
  phoenix: { lat: 33.4484, lng: -112.074 },
  'san antonio': { lat: 29.4241, lng: -98.4936 },
};

export function getLocationBias(city: string): LocationBias | null {
  const coords = CITY_COORDINATES[city.trim().toLowerCase()];
  if (!coords) return null;
  return { ...coords, radiusMeters: DEFAULT_RADIUS_METERS };
}

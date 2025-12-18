import { env } from '../env.js';
import type { Place } from '../models/LocationPing.js';

const cache = new Map<string, { at: number; place: Place }>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place | undefined> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.place;

  // Prefer Google Geocoding if configured, else Nominatim.
  const place = env.GOOGLE_MAPS_API_KEY
    ? await reverseGeocodeGoogle(lat, lng).catch(() => undefined)
    : undefined;

  const resolved = place ?? (await reverseGeocodeNominatim(lat, lng).catch(() => undefined));
  if (resolved) cache.set(key, { at: Date.now(), place: resolved });
  return resolved;
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<Place> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'restofind/1.0 (demo)',
      'Accept-Language': 'en'
    }
  });

  if (!res.ok) throw new Error(`nominatim_reverse_failed:${res.status}`);
  const data = (await res.json()) as any;

  const addr = data.address ?? {};

  return {
    displayName: data.display_name,
    city: addr.city || addr.town || addr.village,
    locality: addr.suburb || addr.borough || addr.county,
    region: addr.state || addr.region,
    regionCode: addr.state_code,
    road: addr.road,
    neighbourhood: addr.neighbourhood,
    postcode: addr.postcode,
    country: addr.country,
    countryCode: addr.country_code ? String(addr.country_code).toUpperCase() : undefined
  };
}

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<Place> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`google_geocode_failed:${res.status}`);
  const data = (await res.json()) as any;

  const first = data.results?.[0];
  const components: any[] = first?.address_components ?? [];

  const getLong = (type: string) => components.find((c) => c.types?.includes(type))?.long_name;
  const getShort = (type: string) => components.find((c) => c.types?.includes(type))?.short_name;

  return {
    displayName: first?.formatted_address,
    city: getLong('locality') || getLong('postal_town') || getLong('administrative_area_level_2'),
    locality: getLong('sublocality') || getLong('neighborhood'),
    region: getLong('administrative_area_level_1'),
    regionCode: getShort('administrative_area_level_1'),
    road: getLong('route'),
    neighbourhood: getLong('neighborhood') || getLong('sublocality'),
    postcode: getLong('postal_code'),
    country: getLong('country'),
    countryCode: getShort('country')
  };
}

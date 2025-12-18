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
    road: addr.road,
    neighbourhood: addr.neighbourhood,
    postcode: addr.postcode,
    country: addr.country
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

  const get = (type: string) => components.find((c) => c.types?.includes(type))?.long_name;

  return {
    displayName: first?.formatted_address,
    city: get('locality') || get('postal_town') || get('administrative_area_level_2'),
    locality: get('sublocality') || get('neighborhood') || get('administrative_area_level_1'),
    road: get('route'),
    neighbourhood: get('neighborhood') || get('sublocality'),
    postcode: get('postal_code'),
    country: get('country')
  };
}

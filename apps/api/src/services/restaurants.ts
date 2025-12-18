import OpeningHours from 'opening_hours';
import { env } from '../env.js';
import { haversineMeters } from '../utils/distance.js';

export type Restaurant = {
  id: string;
  name: string;
  cuisine?: string;
  rating?: number | null;
  isOpen?: boolean | null;
  distanceMeters: number;
  lat: number;
  lng: number;
  delivery?: boolean | null;
  pickup?: boolean | null;
  address?: string;
};

export type RestaurantQuery = {
  lat: number;
  lng: number;
  radiusMeters: number;
  cuisine?: string;
  maxDistanceMeters?: number;
  minRating?: number;
  delivery?: boolean;
  pickup?: boolean;
};

export async function getNearbyRestaurants(q: RestaurantQuery): Promise<Restaurant[]> {
  const base = { lat: q.lat, lng: q.lng };

  const raw = env.GOOGLE_MAPS_API_KEY
    ? await getNearbyRestaurantsGoogle(q).catch(() => getNearbyRestaurantsOsm(q))
    : await getNearbyRestaurantsOsm(q);

  const filtered = raw
    .filter((r) => (q.cuisine ? (r.cuisine ?? '').toLowerCase().includes(q.cuisine.toLowerCase()) : true))
    .filter((r) => (q.maxDistanceMeters ? r.distanceMeters <= q.maxDistanceMeters : true))
    .filter((r) => (q.minRating != null ? (r.rating ?? -1) >= q.minRating : true))
    .filter((r) => (q.delivery != null ? (r.delivery ?? false) === q.delivery : true))
    .filter((r) => (q.pickup != null ? (r.pickup ?? false) === q.pickup : true))
    .map((r) => ({ ...r, distanceMeters: r.distanceMeters ?? haversineMeters(base, r) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return filtered;
}

async function getNearbyRestaurantsGoogle(q: RestaurantQuery): Promise<Restaurant[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${q.lat},${q.lng}`);
  url.searchParams.set('radius', String(q.radiusMeters));
  url.searchParams.set('type', 'restaurant');
  url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`google_places_failed:${res.status}`);
  const data = (await res.json()) as any;

  const results: any[] = data.results ?? [];

  return results
    .map((r) => {
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;

      const distanceMeters = haversineMeters({ lat: q.lat, lng: q.lng }, { lat, lng });

      return {
        id: `g:${r.place_id}`,
        name: r.name ?? 'Unknown',
        cuisine: undefined,
        rating: typeof r.rating === 'number' ? r.rating : null,
        isOpen: typeof r.opening_hours?.open_now === 'boolean' ? r.opening_hours.open_now : null,
        distanceMeters,
        lat,
        lng,
        delivery: null,
        pickup: null,
        address: r.vicinity
      } satisfies Restaurant;
    })
    .filter(Boolean) as Restaurant[];
}

async function getNearbyRestaurantsOsm(q: RestaurantQuery): Promise<Restaurant[]> {
  const overpass = new URL('https://overpass-api.de/api/interpreter');

  const query = `
[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|fast_food|cafe)$"](around:${q.radiusMeters},${q.lat},${q.lng});
  way["amenity"~"^(restaurant|fast_food|cafe)$"](around:${q.radiusMeters},${q.lat},${q.lng});
  relation["amenity"~"^(restaurant|fast_food|cafe)$"](around:${q.radiusMeters},${q.lat},${q.lng});
);
out center tags;
`;

  const res = await fetch(overpass, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'restofind/1.0 (demo)'
    },
    body: new URLSearchParams({ data: query })
  });

  if (!res.ok) throw new Error(`overpass_failed:${res.status}`);
  const data = (await res.json()) as any;
  const els: any[] = data.elements ?? [];

  return els
    .map((el) => {
      const tags = el.tags ?? {};
      const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
      const lng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;

      const name = tags.name ?? 'Unnamed place';
      const cuisine = typeof tags.cuisine === 'string' ? tags.cuisine.replace(/;/g, ', ') : undefined;
      const ohRaw = typeof tags.opening_hours === 'string' ? tags.opening_hours : undefined;

      let isOpen: boolean | null = null;
      if (ohRaw) {
        try {
          const oh = new (OpeningHours as any)(ohRaw);
          isOpen = Boolean(oh.getState());
        } catch {
          isOpen = null;
        }
      }

      const delivery = tags.delivery ? tags.delivery === 'yes' : null;
      const pickup = tags.takeaway ? tags.takeaway === 'yes' : null;

      const distanceMeters = haversineMeters({ lat: q.lat, lng: q.lng }, { lat, lng });

      return {
        id: `osm:${el.type}:${el.id}`,
        name,
        cuisine,
        rating: null,
        isOpen,
        distanceMeters,
        lat,
        lng,
        delivery,
        pickup,
        address: tags['addr:street'] ? `${tags['addr:street']} ${tags['addr:housenumber'] ?? ''}`.trim() : undefined
      } satisfies Restaurant;
    })
    .filter(Boolean) as Restaurant[];
}

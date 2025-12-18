const opening_hours = require('opening_hours');
const { haversineMeters } = require('./util/distance');

function normalizeCuisine(cuisine) {
  if (!cuisine) return '';
  return String(cuisine)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}

function deriveOpenNow(tags, lat, lng) {
  const oh = tags?.opening_hours;
  if (!oh) return null;
  try {
    const o = new opening_hours(oh, { lat, lon: lng }, { locale: 'en' });
    return o.getState();
  } catch {
    return null;
  }
}

async function fetchNearbyRestaurantsOSM({ lat, lng, radiusM = 1500, limit = 60 }) {
  const endpoint = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
  const radius = Math.max(200, Math.min(20000, Number(radiusM) || 1500));

  const query = `
[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:${radius},${lat},${lng});
  way["amenity"="restaurant"](around:${radius},${lat},${lng});
  relation["amenity"="restaurant"](around:${radius},${lat},${lng});
);
out center tags;
  `.trim();

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({ data: query }).toString(),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Overpass failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const els = Array.isArray(data.elements) ? data.elements : [];

  const rows = els
    .map((el) => {
      const tags = el.tags || {};
      const centerLat = el.type === 'node' ? el.lat : el.center?.lat;
      const centerLng = el.type === 'node' ? el.lon : el.center?.lon;
      if (typeof centerLat !== 'number' || typeof centerLng !== 'number') return null;

      const name = tags.name || tags['brand'] || 'Unnamed restaurant';
      const cuisine = normalizeCuisine(tags.cuisine);
      const distanceM = haversineMeters(lat, lng, centerLat, centerLng);
      const openNow = deriveOpenNow(tags, centerLat, centerLng);

      const delivery =
        tags.delivery === 'yes' || tags['delivery:covid19'] === 'yes' || tags['delivery'] === 'only';
      const pickup =
        tags.takeaway === 'yes' || tags['takeaway:covid19'] === 'yes' || tags.takeaway === 'only';

      const id = `${el.type}/${el.id}`;

      return {
        id,
        name,
        cuisine,
        rating: null,
        openNow,
        distanceM,
        lat: centerLat,
        lng: centerLng,
        delivery: Boolean(delivery),
        pickup: Boolean(pickup),
        source: 'osm',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 60)));

  return rows;
}

module.exports = { fetchNearbyRestaurantsOSM };


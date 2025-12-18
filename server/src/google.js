const { haversineMeters } = require('./util/distance');

function requireGoogleKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Missing GOOGLE_MAPS_API_KEY');
  return key;
}

function pickComponent(components, type) {
  const c = components.find((x) => Array.isArray(x.types) && x.types.includes(type));
  return c?.long_name || '';
}

async function reverseGeocodeGoogle({ lat, lng }) {
  const key = requireGoogleKey();
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json?' +
    new URLSearchParams({
      latlng: `${lat},${lng}`,
      key,
    }).toString();

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Google geocode failed (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    throw new Error(`Google geocode status: ${data.status || 'UNKNOWN'}`);
  }

  const best = data.results[0];
  const comps = Array.isArray(best.address_components) ? best.address_components : [];

  const city =
    pickComponent(comps, 'locality') ||
    pickComponent(comps, 'postal_town') ||
    pickComponent(comps, 'administrative_area_level_2') ||
    pickComponent(comps, 'administrative_area_level_1');

  const locality =
    pickComponent(comps, 'sublocality') ||
    pickComponent(comps, 'sublocality_level_1') ||
    pickComponent(comps, 'neighborhood');

  const road = pickComponent(comps, 'route');
  const country = pickComponent(comps, 'country');

  return {
    placeName: best.formatted_address || '',
    city: city || '',
    locality: locality || '',
    road: road || '',
    country: country || '',
    raw: data,
  };
}

async function fetchNearbyRestaurantsGoogle({ lat, lng, radiusM = 1500, limit = 60 }) {
  const key = requireGoogleKey();
  const radius = Math.max(200, Math.min(50000, Number(radiusM) || 1500));

  const url =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json?' +
    new URLSearchParams({
      location: `${lat},${lng}`,
      radius: String(radius),
      type: 'restaurant',
      key,
    }).toString();

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Google places failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    // Common statuses: OK, ZERO_RESULTS, OVER_QUERY_LIMIT, REQUEST_DENIED, INVALID_REQUEST
    throw new Error(`Google places status: ${data.status || 'UNKNOWN'}`);
  }

  const results = Array.isArray(data.results) ? data.results : [];

  const rows = results
    .map((r) => {
      const loc = r?.geometry?.location;
      if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;

      const types = Array.isArray(r.types) ? r.types : [];
      const delivery = types.includes('meal_delivery');
      const pickup = types.includes('meal_takeaway');
      const openNow =
        typeof r?.opening_hours?.open_now === 'boolean' ? r.opening_hours.open_now : null;

      return {
        id: r.place_id || `${loc.lat},${loc.lng}:${r.name || 'restaurant'}`,
        name: r.name || 'Unnamed restaurant',
        // Google Nearby Search does not return cuisine; keep empty for now.
        cuisine: '',
        rating: typeof r.rating === 'number' ? r.rating : null,
        openNow,
        distanceM: haversineMeters(lat, lng, loc.lat, loc.lng),
        lat: loc.lat,
        lng: loc.lng,
        delivery,
        pickup,
        source: 'google',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 60)));

  return rows;
}

module.exports = { reverseGeocodeGoogle, fetchNearbyRestaurantsGoogle };


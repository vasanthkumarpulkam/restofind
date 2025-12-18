function pickCity(address) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.county ||
    ''
  );
}

async function reverseGeocodeNominatim({ lat, lng }) {
  const base = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
  const url =
    `${base}/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lng)}`;

  const userAgent =
    process.env.NOMINATIM_USER_AGENT || 'restofind/1.0 (local dev)';

  const resp = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept-Language': 'en',
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Nominatim reverse geocode failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const address = data.address || {};

  return {
    placeName: data.display_name || '',
    city: pickCity(address),
    locality: address.suburb || address.neighbourhood || address.locality || '',
    road: address.road || address.pedestrian || address.footway || '',
    country: address.country || '',
    raw: data,
  };
}

module.exports = { reverseGeocodeNominatim };


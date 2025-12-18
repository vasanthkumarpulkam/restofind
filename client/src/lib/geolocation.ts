export type GeoResult = {
  lat: number
  lng: number
  accuracyM: number | null
  tsMs: number
}

export function requestExactLocation(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported in this browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          tsMs: pos.timestamp ? Number(pos.timestamp) : Date.now(),
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Location permission denied'))
        else if (err.code === err.POSITION_UNAVAILABLE)
          reject(new Error('Location position unavailable'))
        else if (err.code === err.TIMEOUT) reject(new Error('Location request timed out'))
        else reject(new Error('Failed to get location'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  })
}


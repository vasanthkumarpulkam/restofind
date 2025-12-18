import { useCallback, useState } from 'react'

export type GeoState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | {
      status: 'ready'
      coords: { lat: number; lng: number; accuracy?: number }
      timestamp: string
    }
  | { status: 'error'; message: string }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' })

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Geolocation is not supported by this browser.' })
      return
    }

    setState({ status: 'requesting' })

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: 'ready',
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          timestamp: new Date(pos.timestamp).toISOString(),
        })
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please allow location access to continue.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'Location unavailable. Try again or move to an open area.'
              : 'Location request timed out. Please try again.'
        setState({ status: 'error', message })
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  }, [])

  return { state, request }
}

import * as Location from 'expo-location'
import { useEffect, useState } from 'react'

export type UserLocation = {
  lat: number
  lng: number
  accuracyM: number | null
}

export type UserLocationState = {
  location: UserLocation | null
  error: string | null
  status: 'idle' | 'requesting' | 'denied' | 'watching' | 'error'
}

// 'precise' drives live AR wayfinding (navigation-grade, sub-second); 'coarse' backs static
// readouts like a distance label, where a 5s/25m cadence is ample and spares battery + the map.
export type LocationProfile = 'precise' | 'coarse'

const PROFILES: Record<
  LocationProfile,
  { accuracy: Location.Accuracy; timeInterval: number; distanceInterval: number }
> = {
  precise: {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1_000,
    distanceInterval: 1,
  },
  coarse: { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 25 },
}

const INITIAL: UserLocationState = { location: null, error: null, status: 'idle' }

export function useUserLocation(
  enabled: boolean,
  profile: LocationProfile = 'precise',
): UserLocationState {
  const [state, setState] = useState<UserLocationState>(INITIAL)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let sub: Location.LocationSubscription | null = null
    const watch = PROFILES[profile]

    async function start() {
      setState({ location: null, error: null, status: 'requesting' })
      const permission = await Location.requestForegroundPermissionsAsync()
      if (cancelled) {
        return
      }
      if (permission.status !== 'granted') {
        setState({ location: null, error: 'Permission denied', status: 'denied' })
        return
      }
      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: watch.accuracy,
            timeInterval: watch.timeInterval,
            distanceInterval: watch.distanceInterval,
          },
          (position) => {
            setState({
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracyM:
                  typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
              },
              error: null,
              status: 'watching',
            })
          },
        )
      } catch (error) {
        setState({
          location: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'error',
        })
      }
    }

    void start()

    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled, profile])

  return enabled ? state : INITIAL
}

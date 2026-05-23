import * as Location from 'expo-location'
import { useEffect, useState } from 'react'

export type HeadingAccuracy = 0 | 1 | 2 | 3
export type HeadingState = {
  heading: number
  accuracy: HeadingAccuracy
  available: boolean
}

const INITIAL: HeadingState = { heading: 0, accuracy: 0, available: false }

// Low-pass smoothing with wrap-around (preserves 0/360 boundary stability).
function smoothHeading(prev: number, next: number, alpha = 0.18): number {
  const diff = ((next - prev + 540) % 360) - 180
  return (prev + alpha * diff + 360) % 360
}

export function useHeading(enabled: boolean): HeadingState {
  const [state, setState] = useState<HeadingState>(INITIAL)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let sub: Location.LocationSubscription | null = null
    let last = 0

    async function start() {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (cancelled || permission.status !== 'granted') {
        return
      }
      try {
        sub = await Location.watchHeadingAsync((reading) => {
          // Prefer trueHeading when calibrated, fall back to magnetic.
          const raw =
            reading.trueHeading != null && reading.trueHeading >= 0
              ? reading.trueHeading
              : reading.magHeading
          const smoothed = smoothHeading(last, raw)
          last = smoothed
          setState({
            heading: smoothed,
            accuracy: (reading.accuracy ?? 0) as HeadingAccuracy,
            available: true,
          })
        })
      } catch {
        setState(INITIAL)
      }
    }

    void start()

    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled])

  return enabled ? state : INITIAL
}

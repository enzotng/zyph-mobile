import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'

import { clearMemberLocation, upsertMemberLocation } from '../api/wayfinder.api'

export type ShareLocationStatus = 'idle' | 'requesting' | 'sharing' | 'denied' | 'error'

type Options = {
  tripId: string
  enabled: boolean
}

const MIN_INTERVAL_MS = 5_000
const MIN_DISTANCE_M = 10
const MIN_WRITE_INTERVAL_MS = 10_000

export function useShareLocation({ tripId, enabled }: Options) {
  const [status, setStatus] = useState<ShareLocationStatus>('idle')
  const watcherRef = useRef<Location.LocationSubscription | null>(null)
  const lastWriteAtRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setStatus('requesting')
      const permission = await Location.requestForegroundPermissionsAsync()
      if (cancelled) {
        return
      }
      if (permission.status !== 'granted') {
        setStatus('denied')
        return
      }
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: MIN_INTERVAL_MS,
            distanceInterval: MIN_DISTANCE_M,
          },
          (position) => {
            const now = Date.now()
            if (now - lastWriteAtRef.current < MIN_WRITE_INTERVAL_MS) {
              return
            }
            lastWriteAtRef.current = now
            void upsertMemberLocation({
              tripId,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracyM:
                typeof position.coords.accuracy === 'number' ? position.coords.accuracy : undefined,
              headingDeg:
                typeof position.coords.heading === 'number' && position.coords.heading >= 0
                  ? position.coords.heading
                  : undefined,
            }).catch(() => {})
          },
        )
        if (cancelled) {
          sub.remove()
          return
        }
        watcherRef.current = sub
        setStatus('sharing')
      } catch {
        setStatus('error')
      }
    }

    async function stop() {
      watcherRef.current?.remove()
      watcherRef.current = null
      lastWriteAtRef.current = 0
      setStatus('idle')
      try {
        await clearMemberLocation(tripId)
      } catch {
        // best-effort: stay idle even if remote clear fails
      }
    }

    if (enabled) {
      void start()
    } else {
      void stop()
    }

    return () => {
      cancelled = true
      const wasSharing = watcherRef.current !== null || enabled
      watcherRef.current?.remove()
      watcherRef.current = null
      if (wasSharing) {
        // Leaving the screen while sharing must not leave a stale row on the server.
        void clearMemberLocation(tripId).catch(() => {})
      }
    }
  }, [enabled, tripId])

  return { status }
}

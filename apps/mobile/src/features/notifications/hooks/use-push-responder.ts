import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'

import { routeToNotification } from '../route'

type PushData = {
  type?: unknown
  tripId?: unknown
  expenseId?: unknown
  eventId?: unknown
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// Deep-links into the app when a lock-screen push is tapped, mirroring the in-app feed routing.
// Handles both a cold start (app launched from a push) and taps while the app is running. Gated on
// `enabled` (the user is signed in) so a tap never routes into a trip an unauthenticated session
// cannot read; the cold-start response is consumed once.
export function usePushNotificationResponder(enabled: boolean): void {
  const router = useRouter()
  const coldStartHandled = useRef(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    function handle(data: PushData | undefined): void {
      const type = asString(data?.type)
      if (!type) {
        return
      }
      routeToNotification(router, type, asString(data?.tripId) ?? null, {
        expenseId: asString(data?.expenseId),
        eventId: asString(data?.eventId),
      })
    }

    if (!coldStartHandled.current) {
      coldStartHandled.current = true
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        handle(response?.notification.request.content.data as PushData | undefined)
      })
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response.notification.request.content.data as PushData | undefined)
    })
    return () => subscription.remove()
  }, [enabled, router])
}

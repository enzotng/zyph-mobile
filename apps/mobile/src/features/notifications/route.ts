import { categoryForType, isDetachedRecipient } from './schemas'

// expo-router's router instance type, taken without a runtime import so this helper stays usable
// from both a screen (useRouter()) and the push tap handler.
type AppRouter = ReturnType<typeof import('expo-router').useRouter>

type NotificationRoutePayload =
  | { expenseId?: string; eventId?: string; detachedUserId?: string }
  | null
  | undefined

// Routes a tapped notification - an in-app feed row or a lock-screen push - to its detail screen.
// member.removed is informational (the user lost trip access, so RLS would block the trip), the
// detached recipient of a member.detached lost it the same way, and a missing trip id no-ops too.
// Expense/event deep-link when their id is present in the payload, otherwise the relevant tab or
// the trip overview is the fallback.
export function routeToNotification(
  router: AppRouter,
  type: string,
  tripId: string | null | undefined,
  payload: NotificationRoutePayload,
  userId?: string | null,
): void {
  if (type === 'member.removed' || !tripId || isDetachedRecipient(type, payload, userId)) {
    return
  }
  const p = payload ?? {}
  const category = categoryForType(type)
  if (category === 'expenses' && p.expenseId) {
    router.push({
      pathname: '/trips/[id]/expenses/[expenseId]',
      params: { id: tripId, expenseId: p.expenseId },
    })
  } else if (category === 'timeline' && p.eventId) {
    router.push({
      pathname: '/trips/[id]/events/[eventId]',
      params: { id: tripId, eventId: p.eventId },
    })
  } else if (category === 'members') {
    router.push({ pathname: '/trips/[id]/group', params: { id: tripId } })
  } else {
    router.push({ pathname: '/trips/[id]', params: { id: tripId } })
  }
}

import { routeToNotification } from './route'

type PushTarget = { pathname: string; params: Record<string, string> }
type Router = Parameters<typeof routeToNotification>[0]

function makeRouter() {
  const calls: PushTarget[] = []
  const router = {
    push: (target: PushTarget) => {
      calls.push(target)
    },
  }
  return { router: router as unknown as Router, calls }
}

describe('routeToNotification', () => {
  it('deep-links an expense notification to the expense detail', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'expense.added', 'trip-1', { expenseId: 'exp-1' })
    expect(calls).toEqual([
      {
        pathname: '/trips/[id]/expenses/[expenseId]',
        params: { id: 'trip-1', expenseId: 'exp-1' },
      },
    ])
  })

  it('deep-links a timeline notification to the event detail', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'event.added', 'trip-1', { eventId: 'evt-1' })
    expect(calls).toEqual([
      { pathname: '/trips/[id]/events/[eventId]', params: { id: 'trip-1', eventId: 'evt-1' } },
    ])
  })

  it('routes a member notification to the group screen', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'member.joined', 'trip-1', null)
    expect(calls).toEqual([{ pathname: '/trips/[id]/group', params: { id: 'trip-1' } }])
  })

  it('falls back to the trip overview for settlements and packing', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'settlement.created', 'trip-1', { role: 'to' } as never)
    routeToNotification(router, 'packing.assigned', 'trip-1', null)
    expect(calls).toEqual([
      { pathname: '/trips/[id]', params: { id: 'trip-1' } },
      { pathname: '/trips/[id]', params: { id: 'trip-1' } },
    ])
  })

  it('falls back to the trip overview when an expense id is missing', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'expense.added', 'trip-1', {})
    expect(calls).toEqual([{ pathname: '/trips/[id]', params: { id: 'trip-1' } }])
  })

  it('does not route an informational member.removed notification', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'member.removed', 'trip-1', null)
    expect(calls).toEqual([])
  })

  it('does not route when the trip id is missing', () => {
    const { router, calls } = makeRouter()
    routeToNotification(router, 'expense.added', null, { expenseId: 'exp-1' })
    expect(calls).toEqual([])
  })
})

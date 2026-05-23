import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { listEvents } from '@/features/timeline/api/timeline.api'
import { listMemberLocations, listPois } from '@/features/wayfinder/api/wayfinder.api'

import { useWayfinderTargets } from './use-wayfinder-targets'

jest.mock('@/features/timeline/api/timeline.api')
jest.mock('@/features/wayfinder/api/wayfinder.api')

const mockListEvents = listEvents as jest.Mock
const mockListPois = listPois as jest.Mock
const mockListMemberLocations = listMemberLocations as jest.Mock

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

const baseEvent = {
  id: 'ev1',
  trip_id: 't1',
  title: 'Flight AF1234',
  type: 'flight',
  starts_at: '2026-06-01T10:00:00Z',
  ends_at: null,
  notes: null,
  location: null,
  lat: 48.8566,
  lng: 2.3522,
  gate_location: null,
  created_by: 'u1',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useWayfinderTargets', () => {
  it('aggregates events with lat/lng', async () => {
    mockListEvents.mockResolvedValue([baseEvent])
    mockListPois.mockResolvedValue([])
    mockListMemberLocations.mockResolvedValue([])

    const { result } = renderHook(() => useWayfinderTargets('t1', false), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.targets.length).toBeGreaterThan(0))

    expect(result.current.targets[0]).toMatchObject({
      kind: 'event',
      label: 'Flight AF1234',
      lat: 48.8566,
      lng: 2.3522,
    })
  })

  it('skips events without coordinates', async () => {
    mockListEvents.mockResolvedValue([{ ...baseEvent, lat: null, lng: null }])
    mockListPois.mockResolvedValue([])
    mockListMemberLocations.mockResolvedValue([])

    const { result } = renderHook(() => useWayfinderTargets('t1', false), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.targets).toHaveLength(0)
  })

  it('emits a separate gate target when gate_location is set', async () => {
    mockListEvents.mockResolvedValue([
      {
        ...baseEvent,
        gate_location: { label: 'Gate 24B', lat: 48.857, lng: 2.353 },
      },
    ])
    mockListPois.mockResolvedValue([])
    mockListMemberLocations.mockResolvedValue([])

    const { result } = renderHook(() => useWayfinderTargets('t1', false), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.targets.length).toBe(2))
    const gate = result.current.targets.find((t) => t.kind === 'gate')
    expect(gate).toMatchObject({ label: 'Gate 24B', lat: 48.857, lng: 2.353 })
  })

  it('includes POIs from the trip', async () => {
    mockListEvents.mockResolvedValue([])
    mockListPois.mockResolvedValue([
      {
        id: 'p1',
        trip_id: 't1',
        label: 'Toilettes T2C',
        icon: 'wc',
        lat: 49.01,
        lng: 2.55,
        created_by: 'u1',
        created_at: '2026-05-22T00:00:00Z',
        updated_at: '2026-05-22T00:00:00Z',
      },
    ])
    mockListMemberLocations.mockResolvedValue([])

    const { result } = renderHook(() => useWayfinderTargets('t1', false), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.targets.length).toBeGreaterThan(0))
    expect(result.current.targets[0]).toMatchObject({
      kind: 'poi',
      label: 'Toilettes T2C',
      icon: 'wc',
    })
  })

  it('omits member targets when includeMembers is false', async () => {
    mockListEvents.mockResolvedValue([])
    mockListPois.mockResolvedValue([])
    mockListMemberLocations.mockResolvedValue([
      {
        trip_member_id: 'm1',
        lat: 48.86,
        lng: 2.35,
        accuracy_m: 10,
        heading_deg: null,
        updated_at: '2026-05-23T15:00:00Z',
        trip_member: { id: 'm1', user_id: 'u2', status: 'active', profile: null },
      },
    ])

    const { result } = renderHook(() => useWayfinderTargets('t1', false), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.targets.filter((t) => t.kind === 'member')).toHaveLength(0)
  })

  it('includes member targets when includeMembers is true', async () => {
    mockListEvents.mockResolvedValue([])
    mockListPois.mockResolvedValue([])
    mockListMemberLocations.mockResolvedValue([
      {
        trip_member_id: 'm1',
        lat: 48.86,
        lng: 2.35,
        accuracy_m: 10,
        heading_deg: null,
        updated_at: '2026-05-23T15:00:00Z',
        trip_member: {
          id: 'm1',
          user_id: 'u2',
          status: 'active',
          profile: { id: 'u2', display_name: 'Tom', avatar_url: null },
        },
      },
    ])

    const { result } = renderHook(() => useWayfinderTargets('t1', true), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.targets.length).toBeGreaterThan(0))
    const member = result.current.targets.find((t) => t.kind === 'member')
    expect(member).toMatchObject({ label: 'Tom', icon: 'star' })
  })
})

import { useMemo } from 'react'

import { useEvents } from '@/features/timeline/hooks/use-timeline'

import { useMemberLocations, usePois } from './use-wayfinder'

export type WayfinderTargetKind = 'event' | 'poi' | 'member' | 'gate'

export type WayfinderTarget = {
  id: string
  kind: WayfinderTargetKind
  label: string
  icon: string
  lat: number
  lng: number
  startsAt?: string | null
  sourceId: string
}

export function useWayfinderTargets(tripId: string, includeMembers: boolean) {
  const eventsQuery = useEvents(tripId)
  const poisQuery = usePois(tripId)
  const membersQuery = useMemberLocations(tripId, includeMembers)

  const targets = useMemo<WayfinderTarget[]>(() => {
    const out: WayfinderTarget[] = []

    for (const event of eventsQuery.data ?? []) {
      if (event.lat != null && event.lng != null) {
        out.push({
          id: `event:${event.id}`,
          kind: 'event',
          label: event.title,
          icon: event.type === 'flight' ? 'gate' : 'pin',
          lat: event.lat,
          lng: event.lng,
          startsAt: event.starts_at,
          sourceId: event.id,
        })
      }

      const gate = event.gate_location as { label?: string; lat?: number; lng?: number } | null
      if (gate && typeof gate.lat === 'number' && typeof gate.lng === 'number') {
        out.push({
          id: `gate:${event.id}`,
          kind: 'gate',
          label: gate.label ?? `${event.title} - gate`,
          icon: 'gate',
          lat: gate.lat,
          lng: gate.lng,
          startsAt: event.starts_at,
          sourceId: event.id,
        })
      }
    }

    for (const poi of poisQuery.data ?? []) {
      out.push({
        id: `poi:${poi.id}`,
        kind: 'poi',
        label: poi.label,
        icon: poi.icon,
        lat: poi.lat,
        lng: poi.lng,
        sourceId: poi.id,
      })
    }

    if (includeMembers) {
      for (const member of membersQuery.data ?? []) {
        const profile = member.trip_member?.profile
        const memberId = member.trip_member?.id ?? member.trip_member_id
        out.push({
          id: `member:${memberId}`,
          kind: 'member',
          label: profile?.display_name ?? 'Member',
          icon: 'star',
          lat: member.lat,
          lng: member.lng,
          sourceId: memberId,
        })
      }
    }

    out.sort((a, b) => {
      if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt)
      if (a.startsAt) return -1
      if (b.startsAt) return 1
      return a.label.localeCompare(b.label)
    })

    return out
  }, [eventsQuery.data, poisQuery.data, membersQuery.data, includeMembers])

  return {
    targets,
    isLoading:
      eventsQuery.isLoading || poisQuery.isLoading || (includeMembers && membersQuery.isLoading),
    isError: eventsQuery.isError || poisQuery.isError || (includeMembers && membersQuery.isError),
  }
}
